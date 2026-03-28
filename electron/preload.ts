/**
 * electron/preload.ts
 *
 * Minimal preload script for Realmweaver desktop.
 * Exposes platform info to the renderer process via contextBridge.
 */

import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('realmweaverDesktop', {
  platform: process.platform,
  isDesktop: true,
});
