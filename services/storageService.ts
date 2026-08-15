/**
 * storageService.ts
 *
 * Abstracts all persistence concerns for Realmweaver:
 *   5.3  Storage quota detection
 *   5.4  IndexedDB fallback when localStorage quota is exceeded
 *   5.5  Multi-tab conflict detection via the `storage` event
 *   5.6  Auto-backup: rotating buffer of the last 3 saves
 *
 * Public API (all named exports):
 *   createStorageService()  — factory, returns a singleton-compatible service object
 *   storageService          — the default singleton used by campaignService
 *
 * Implementation note: all localStorage access goes through `_ls()` so that
 * the reference is resolved lazily at call time. This keeps the module
 * compatible with Node test environments where `vi.stubGlobal('localStorage')`
 * sets the value on `globalThis` before each test run.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type StorageBackend = 'localStorage' | 'indexedDB';

export interface BackupEntry {
  /** 1-based slot index (1 = newest). */
  index: number;
  /** ISO timestamp of when this backup was saved. */
  timestamp: string;
  /** Serialized campaign data for this backup. */
  data: string;
}

export interface SaveResult {
  success: boolean;
  backend: StorageBackend;
  quotaWarning: boolean;
  error?: string;
  /**
   * Resolves once the write is durably confirmed (immediately for a
   * successful localStorage write; the underlying IndexedDB write promise
   * for a quota-fallback write). Rejects if the write never durably lands.
   * Callers that need to know whether a save was ACTUALLY persisted (not
   * just synchronously accepted) should await this before trusting
   * `success`/`quotaWarning`.
   */
  pending?: Promise<void>;
}

export interface SaveOptions {
  /**
   * Skip the rotating-backup buffer for this write entirely (finding #0
   * refinement). Intended for small scalar keys — e.g. the
   * active-campaign-id — where a 3-slot backup history is pure overhead:
   * it doubles up as noise in the buffer meant to hold recoverable
   * *campaign* generations, and every no-op write to it hollows out that
   * buffer's effective depth without protecting anything worth restoring.
   */
  skipBackup?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IDB_DB_NAME = 'realmweaver-db';
const IDB_DB_VERSION = 1;
const IDB_STORE_NAME = 'campaigns';

const MAX_BACKUPS = 3;

// ---------------------------------------------------------------------------
// Environment-safe accessors
//
// Using lazy getters instead of bare identifiers makes this module work in
// Node test environments where `localStorage` / `window` are injected into
// `globalThis` by the test framework (e.g. vi.stubGlobal) rather than being
// native globals.
// ---------------------------------------------------------------------------

/** Returns the current globalThis.localStorage (may be undefined in Node). */
function _ls(): Storage | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).localStorage ?? null;
}

/** Returns globalThis.window (may be undefined in Node). */
function _win(): (Window & typeof globalThis) | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).window ?? null;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers (async, Promise-based, no external deps)
// ---------------------------------------------------------------------------

function openIdb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const idb = (globalThis as any).indexedDB;
    if (!idb) {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const request = idb.open(IDB_DB_NAME, IDB_DB_VERSION) as IDBOpenDBRequest;
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbSet(key: string, value: string): Promise<void> {
  return openIdb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

function idbGet(key: string): Promise<string | null> {
  return openIdb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readonly');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

function idbRemove(key: string): Promise<void> {
  return openIdb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.delete(key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      })
  );
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createStorageService() {
  // Whether the last save used IDB because localStorage was full.
  let _usingIdbFallback = false;
  let _quotaWarning = false;

  // Conflict detection callbacks registered via onConflict().
  const _conflictListeners = new Set<(key: string) => void>();

  // ---------------------------------------------------------------------------
  // Backup helpers (5.6)
  // ---------------------------------------------------------------------------

  function _backupKey(primaryKey: string, index: number): string {
    return `${primaryKey}__backup_${index}`;
  }

  // One-time migration: the pre-namespacing scheme wrote every backup under
  // a single fixed `CAMPAIGNS_BACKUP_<n>` key regardless of which primary
  // key was being saved (finding #0). Those keys are orphaned dead weight
  // under the namespaced scheme — nothing reads them and they are never
  // reused — so remove them the first time this service instance saves
  // anything, rather than carrying an extra stale campaign copy forever for
  // any user who saved under the old code.
  let _legacyBackupKeysCleaned = false;
  function _cleanupLegacyBackupKeys(): void {
    if (_legacyBackupKeysCleaned) return;
    _legacyBackupKeysCleaned = true;
    const ls = _ls();
    if (!ls) return;
    try {
      for (let i = 1; i <= MAX_BACKUPS; i++) {
        ls.removeItem(`CAMPAIGNS_BACKUP_${i}`);
      }
    } catch {
      // best-effort cleanup only
    }
  }

  /**
   * Before overwriting the primary key, rotate backups (namespaced per
   * primaryKey so unrelated keys — e.g. the scalar active-campaign-id — never
   * share a slot buffer with the campaigns JSON):
   *   _3 is discarded, _2 → _3, _1 → _2, previous-value → _1
   *
   * Takes the value that is ABOUT to be overwritten (captured by the caller
   * before the primary write) so rotation never has to re-read a stale
   * primary value, and can safely run AFTER the primary write succeeds —
   * meaning it never competes with the primary write for quota headroom.
   */
  function _rotateBackups(primaryKey: string, previousValue: string | null): void {
    const ls = _ls();
    if (!ls) return;
    if (previousValue === null) return; // nothing to back up on first-ever save
    try {
      // Shift existing backups down one slot (oldest first to avoid overwrite)
      for (let i = MAX_BACKUPS; i >= 2; i--) {
        const olderSlot = _backupKey(primaryKey, i);
        const newerSlot = _backupKey(primaryKey, i - 1);
        const newerRaw = ls.getItem(newerSlot);
        if (newerRaw !== null) {
          ls.setItem(olderSlot, newerRaw);
        } else {
          ls.removeItem(olderSlot);
        }
      }
      // Capture the previous primary value into slot 1
      const slot1 = JSON.stringify({
        timestamp: new Date().toISOString(),
        data: previousValue,
      });
      ls.setItem(_backupKey(primaryKey, 1), slot1);
    } catch {
      // Backup rotation is best-effort; never block the primary save.
    }
  }

  // ---------------------------------------------------------------------------
  // Multi-tab conflict detection setup (5.5)
  // ---------------------------------------------------------------------------

  const BACKUP_KEY_PATTERN = /__backup_\d+$/;

  function _initConflictDetection(): void {
    const win = _win();
    if (!win) return;
    win.addEventListener('storage', (event: StorageEvent) => {
      // Only care about keys we own (primary campaign data, not backups)
      if (event.key && !BACKUP_KEY_PATTERN.test(event.key)) {
        _conflictListeners.forEach((cb) => cb(event.key!));
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Save `value` under `key`.
   *
   * Flow:
   *  1. Try localStorage.setItem.
   *  2. On success, rotate backups using the value that was just overwritten
   *     (runs AFTER the primary write so it never competes with it for quota
   *     headroom).
   *  3. On QuotaExceededError, fall back to IndexedDB (async; tracked via the
   *     returned `pending` promise so callers can await durable confirmation).
   *  4. Return a SaveResult describing what happened.
   */
  function save(key: string, value: string, options?: SaveOptions): SaveResult {
    const ls = _ls();

    if (!ls) {
      // No localStorage available (e.g. SSR context with no injected mock)
      return {
        success: false,
        backend: 'localStorage',
        quotaWarning: false,
        error: 'localStorage not available',
      };
    }

    _cleanupLegacyBackupKeys();

    // Capture the value about to be overwritten, for backup rotation.
    const previousValue = ls.getItem(key);

    try {
      ls.setItem(key, value);
      _usingIdbFallback = false;
      _quotaWarning = false;
      // Finding #0 refinement: don't rotate a fresh copy through the buffer
      // for a no-op save (previousValue === value — e.g. a page navigation
      // that flushes with nothing actually changed), and let callers opt
      // small scalar keys (e.g. the active-campaign-id) out of the backup
      // buffer entirely, since a rotating history of a bare id string
      // protects nothing while still consuming a slot buffer and evicting
      // older, actually-useful generations of other keys is never at risk
      // here — but every no-op/scalar rotation is still wasted writes.
      if (!options?.skipBackup && previousValue !== value) {
        _rotateBackups(key, previousValue);
      }
      return { success: true, backend: 'localStorage', quotaWarning: false, pending: Promise.resolve() };
    } catch (e) {
      const isQuota =
        e instanceof DOMException &&
        (e.name === 'QuotaExceededError' ||
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          e.code === 22);

      if (isQuota) {
        _quotaWarning = true;
        _usingIdbFallback = true;

        // Fall back to IndexedDB. We don't await here to keep the calling
        // save path synchronous, but the returned `pending` promise lets
        // callers (campaignService.persistToStorage) wait for durable
        // confirmation before reporting success. Once the IDB write
        // succeeds, drop the stale localStorage copy: `load()` prefers
        // localStorage, so leaving the old value there would shadow the
        // fresher IndexedDB data on the next startup (and removing it also
        // frees quota for future saves).
        const pending = idbSet(key, value)
          .then(() => {
            try {
              _ls()?.removeItem(key);
              // The pre-quota generation just left localStorage — capture it
              // into the backup buffer so recovery depth isn't lost exactly
              // on the path where saves start failing. Rotation runs AFTER
              // removeItem so the freed primary-copy space funds the backup
              // write; if even that overflows, _rotateBackups' own guards
              // degrade gracefully.
              if (!options?.skipBackup && previousValue !== null && previousValue !== value) {
                _rotateBackups(key, previousValue);
              }
            } catch {
              // ignore — worst case load() returns the stale localStorage copy
            }
          })
          .catch((idbErr) => {
            console.error('[storageService] IndexedDB fallback write failed:', idbErr);
            throw idbErr;
          });
        // Prevent a false-positive "unhandled rejection" report when a caller
        // doesn't await `pending` (e.g. fire-and-forget callers) — attaching
        // a handler here marks `pending` itself as handled without altering
        // what it resolves/rejects with for callers who DO await it.
        pending.catch(() => {});

        console.warn('[storageService] localStorage quota exceeded — falling back to IndexedDB for key:', key);
        return {
          success: true,
          backend: 'indexedDB',
          quotaWarning: true,
          pending,
        };
      }

      // Unknown error
      console.error('[storageService] Unexpected save error:', e);
      const failedPending = Promise.reject(e instanceof Error ? e : new Error(String(e)));
      failedPending.catch(() => {}); // see comment above — avoid a false-positive unhandled-rejection report
      return {
        success: false,
        backend: _usingIdbFallback ? 'indexedDB' : 'localStorage',
        quotaWarning: _quotaWarning,
        error: e instanceof Error ? e.message : String(e),
        pending: failedPending,
      };
    }
  }

  /**
   * Load `key` synchronously from localStorage.
   * Returns null if localStorage is unavailable or the key is missing.
   */
  function loadSync(key: string): string | null {
    return _ls()?.getItem(key) ?? null;
  }

  /**
   * Async load: checks localStorage first, then IDB (migration case).
   */
  async function load(key: string): Promise<string | null> {
    const localValue = _ls()?.getItem(key) ?? null;
    if (localValue !== null) return localValue;

    // Try IDB as migration source
    try {
      const idbValue = await idbGet(key);
      return idbValue;
    } catch {
      return null;
    }
  }

  /**
   * Remove `key` from both localStorage and IndexedDB.
   */
  function remove(key: string): void {
    try {
      _ls()?.removeItem(key);
    } catch {
      // ignore
    }
    // Best-effort async removal from IDB
    idbRemove(key).catch(() => {});
  }

  /**
   * Subscribe to cross-tab modification events (5.5).
   * The callback receives the storage key that was modified in another tab.
   * Returns an unsubscribe function.
   */
  function onConflict(callback: (key: string) => void): () => void {
    _conflictListeners.add(callback);
    return () => _conflictListeners.delete(callback);
  }

  /**
   * Returns available backup entries (5.6) for `primaryKey`.
   * Slot 1 = most recent, slot 3 = oldest.
   *
   * `primaryKey` is required (finding idx5): backups are namespaced per
   * primary key, so a caller that omits it has no principled key to default
   * to — a "last rotated key" fallback silently returns whichever key
   * happened to save most recently (in the real app, almost always the
   * scalar active-campaign-id, not the campaigns JSON callers actually want),
   * which is the exact class of cross-key confusion finding #0 was about.
   */
  function getBackups(primaryKey: string): BackupEntry[] {
    const ls = _ls();
    if (!ls) return [];
    const key = primaryKey;
    if (!key) return [];
    const results: BackupEntry[] = [];
    for (let i = 1; i <= MAX_BACKUPS; i++) {
      const raw = ls.getItem(_backupKey(key, i));
      if (raw !== null) {
        try {
          const parsed = JSON.parse(raw) as { timestamp: string; data: string };
          results.push({ index: i, timestamp: parsed.timestamp, data: parsed.data });
        } catch {
          // corrupt backup slot — skip
        }
      }
    }
    return results;
  }

  /**
   * Restore from backup slot `index` into the primary `key` (5.6).
   * Does NOT re-rotate backups so the restored data is not immediately
   * overwritten by the next scheduleSave cycle before the app reloads.
   * Returns true on success.
   */
  function restoreFromBackup(primaryKey: string, index: number): boolean {
    const ls = _ls();
    if (!ls) return false;
    const raw = ls.getItem(_backupKey(primaryKey, index));
    if (!raw) return false;
    try {
      const parsed = JSON.parse(raw) as { timestamp: string; data: string };
      ls.setItem(primaryKey, parsed.data);
      return true;
    } catch {
      return false;
    }
  }

  // Initialize conflict detection listener
  _initConflictDetection();

  return {
    save,
    loadSync,
    load,
    remove,
    onConflict,
    getBackups,
    restoreFromBackup,
  };
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** Default singleton used by campaignService and the rest of the app. */
export const storageService = createStorageService();
