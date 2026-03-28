/**
 * electron/main.ts
 *
 * Electron main process entry point for Realmweaver desktop app.
 *
 * In production, starts a local HTTP server that serves the built SPA files
 * AND handles /api/ai/* endpoints (same as vite-plugin-ai-proxy.ts).
 * In development, proxies to the Vite dev server.
 */

import { app, BrowserWindow, shell, dialog } from 'electron';
import path from 'path';
import { startServer, stopServer } from './server.js';

const isDev = process.env.NODE_ENV === 'development';
const DEV_SERVER_URL = 'http://localhost:4200';

let mainWindow: BrowserWindow | null = null;

function createWindow(serverPort: number) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Realmweaver',
    backgroundColor: '#0f172a', // slate-900
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false, // Show after ready-to-show to avoid flash
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://localhost:${serverPort}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  let serverPort: number;

  if (isDev) {
    // In dev mode, the Vite dev server handles everything
    serverPort = 4200;
  } else {
    // In production, start our local server
    const distPath = path.join(__dirname, '..', 'dist');
    serverPort = await startServer(distPath);
  }

  createWindow(serverPort);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(serverPort);
    }
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Handle unhandled errors gracefully
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox(
    'Realmweaver Error',
    `An unexpected error occurred:\n\n${error.message}\n\nThe application may need to be restarted.`
  );
});
