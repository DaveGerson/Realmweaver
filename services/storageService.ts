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

export interface StorageInfo {
  /** Which backend is currently being used for writes. */
  activeBackend: StorageBackend;
  /** Estimated bytes used (localStorage only; undefined if unavailable). */
  estimatedUsedBytes?: number;
  /** Estimated bytes available (navigator.storage.estimate if available). */
  estimatedAvailableBytes?: number;
  /** True when the last save triggered a quota warning. */
  quotaWarning: boolean;
}

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

  function _backupKey(index: number): string {
    return `CAMPAIGNS_BACKUP_${index}`;
  }

  /**
   * Before overwriting the primary key, rotate backups:
   *   _3 is discarded, _2 → _3, _1 → _2, current → _1
   */
  function _rotateBackups(primaryKey: string): void {
    const ls = _ls();
    if (!ls) return;
    try {
      // Shift existing backups down one slot (oldest first to avoid overwrite)
      for (let i = MAX_BACKUPS; i >= 2; i--) {
        const olderSlot = _backupKey(i);
        const newerSlot = _backupKey(i - 1);
        const newerRaw = ls.getItem(newerSlot);
        if (newerRaw !== null) {
          ls.setItem(olderSlot, newerRaw);
        } else {
          ls.removeItem(olderSlot);
        }
      }
      // Capture current primary data into slot 1
      const current = ls.getItem(primaryKey);
      if (current !== null) {
        const slot1 = JSON.stringify({
          timestamp: new Date().toISOString(),
          data: current,
        });
        ls.setItem(_backupKey(1), slot1);
      }
    } catch {
      // Backup rotation is best-effort; never block the primary save.
    }
  }

  // ---------------------------------------------------------------------------
  // Quota estimation (5.3)
  // ---------------------------------------------------------------------------

  async function _estimateQuota(): Promise<{ used?: number; available?: number }> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = (globalThis as any).navigator;
    if (nav?.storage?.estimate) {
      try {
        const estimate = await nav.storage.estimate();
        return {
          used: estimate.usage,
          available: estimate.quota != null && estimate.usage != null
            ? estimate.quota - estimate.usage
            : undefined,
        };
      } catch {
        // ignore
      }
    }
    return {};
  }

  // ---------------------------------------------------------------------------
  // Multi-tab conflict detection setup (5.5)
  // ---------------------------------------------------------------------------

  function _initConflictDetection(): void {
    const win = _win();
    if (!win) return;
    win.addEventListener('storage', (event: StorageEvent) => {
      // Only care about keys we own (primary campaign data, not backups)
      if (event.key && !event.key.startsWith('CAMPAIGNS_BACKUP_')) {
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
   *  1. Rotate backups (captures current value before overwrite).
   *  2. Try localStorage.setItem.
   *  3. On QuotaExceededError, fall back to IndexedDB (fire-and-forget async).
   *  4. Return a SaveResult describing what happened.
   */
  function save(key: string, value: string): SaveResult {
    const ls = _ls();

    // Rotate backups before every write (5.6)
    _rotateBackups(key);

    if (!ls) {
      // No localStorage available (e.g. SSR context with no injected mock)
      return {
        success: false,
        backend: 'localStorage',
        quotaWarning: false,
        error: 'localStorage not available',
      };
    }

    try {
      ls.setItem(key, value);
      _usingIdbFallback = false;
      _quotaWarning = false;
      return { success: true, backend: 'localStorage', quotaWarning: false };
    } catch (e) {
      const isQuota =
        e instanceof DOMException &&
        (e.name === 'QuotaExceededError' ||
          e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          e.code === 22);

      if (isQuota) {
        _quotaWarning = true;
        _usingIdbFallback = true;

        // Fall back to IndexedDB (async; we don't await here to keep the
        // calling save path synchronous, but we track the pending write).
        idbSet(key, value).catch((idbErr) => {
          console.error('[storageService] IndexedDB fallback write failed:', idbErr);
        });

        console.warn('[storageService] localStorage quota exceeded — falling back to IndexedDB for key:', key);
        return {
          success: true,
          backend: 'indexedDB',
          quotaWarning: true,
        };
      }

      // Unknown error
      console.error('[storageService] Unexpected save error:', e);
      return {
        success: false,
        backend: _usingIdbFallback ? 'indexedDB' : 'localStorage',
        quotaWarning: _quotaWarning,
        error: e instanceof Error ? e.message : String(e),
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
   * Returns storage diagnostics (5.3).
   */
  async function getStorageInfo(): Promise<StorageInfo> {
    const quota = await _estimateQuota();
    return {
      activeBackend: _usingIdbFallback ? 'indexedDB' : 'localStorage',
      estimatedUsedBytes: quota.used,
      estimatedAvailableBytes: quota.available,
      quotaWarning: _quotaWarning,
    };
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
   * Returns available backup entries (5.6).
   * Slot 1 = most recent, slot 3 = oldest.
   */
  function getBackups(): BackupEntry[] {
    const ls = _ls();
    if (!ls) return [];
    const results: BackupEntry[] = [];
    for (let i = 1; i <= MAX_BACKUPS; i++) {
      const raw = ls.getItem(_backupKey(i));
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
    const raw = ls.getItem(_backupKey(index));
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
    getStorageInfo,
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
