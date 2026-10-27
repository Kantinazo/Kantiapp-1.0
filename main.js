'use strict';
const { app, BrowserWindow, WebContentsView, Menu, ipcMain, session, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const PLAY_URL = 'https://www.haxball.com/play';
const GAME_PARTITION = 'persist:haxball';
const DEFAULTS = { animations: true, skipWelcome: false, zoom: 1, favorites: [] };

let win = null;
let gameView = null;
let settings = { ...DEFAULTS };
let wantVisible = false;
let lastUrl = PLAY_URL;
let currentUrl = null;
let lastError = null;

/* ---------- Validación de URLs ---------- */

function isHaxballUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && (u.hostname === 'haxball.com' || u.hostname.endsWith('.haxball.com'));
  } catch {
    return false;
  }
}

// Acepta solo enlaces de sala/cliente: https://*.haxball.com/play[?c=...]
function normalizeRoomUrl(value) {
  if (typeof value !== 'string' || value.length > 300) return null;
  const raw = value.trim();
  let u;
  try { u = new URL(raw); } catch {
    try { u = new URL('https://' + raw); } catch { return null; }
  }
  if (!isHaxballUrl(u.href)) return null;
  if (u.pathname.replace(/\/+$/, '') !== '/play') return null;
  u.hash = '';
  return u.href;
}

function openExternalSafe(url) {
  try {
    if (new URL(url).protocol === 'https:') shell.openExternal(url);
  } catch { /* URL inválida: se ignora */ }
}

/* ---------- Ajustes y favoritos (archivo JSON local) ---------- */

const settingsFile = () => path.join(app.getPath('userData'), 'kantinazo-settings.json');

function sanitizeFavorites(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const f of list.slice(0, 200)) {
    if (!f || typeof f.name !== 'string') continue;
    const url = normalizeRoomUrl(f.url);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      id: typeof f.id === 'string' && f.id ? f.id.slice(0, 40) : crypto.randomUUID(),
      name: f.name.trim().slice(0, 60) || 'Sala sin nombre',
      url,
      addedAt: Number(f.addedAt) || Date.now()
    });
  }
  return out;
}

function sanitizeSettings(s) {
  const src = s && typeof s === 'object' ? s : {};
  const zoom = Number(src.zoom);
  return {
    animations: typeof src.animations === 'boolean' ? src.animations : DEFAULTS.animations,
    skipWelcome: typeof src.skipWelcome === 'boolean' ? src.skipWelcome : DEFAULTS.skipWelcome,
    zoom: Number.isFinite(zoom) ? Math.min(1.6, Math.max(0.6, Math.round(zoom * 10) / 10)) : DEFAULTS.zoom,
    favorites: sanitizeFavorites(src.favorites)
  };
}

function loadSettings() {
  try {
    settings = sanitizeSettings(JSON.parse(fs.readFileSync(settingsFile(), 'utf8')));
  } catch {
    settings = { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsFile(), JSON.stringify(settings, null, 2), 'utf8');
  } catch (err) {
    console.error('No se pudieron guardar los ajustes:', err.message);
  }
}

/* ---------- Vista del cliente oficial de HaxBall ---------- */

function emitState() {
  if (!win || win.isDestroyed()) return;
  win.webContents.send('game:state', {
    url: currentUrl,
    loading: gameView ? gameView.webContents.isLoading() : false,
    error: lastError
  });
}

function applyBounds(rect) {
  if (!gameView || !rect) return;
  const n = (v) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0);
  gameView.setBounds({ x: n(rect.x), y: n(rect.y), width: n(rect.width), height: n(rect.height) });
}

function loadGame(url) {
  const view = ensureGameView();
  lastUrl = url;
  lastError = null;
  view.setVisible(wantVisible);
  view.webContents.loadURL(url).catch(() => { /* los fallos llegan por did-fail-load */ });
  emitState();
}

function failGame(code, description) {
  lastError = { code, description };
  if (gameView) gameView.setVisible(false);
  emitState();
}

function ensureGameView() {
  if (gameView) return gameView;

  // Contenido externo: sin Node, sin preload, aislado y con sandbox.
  gameView = new WebContentsView({
    webPreferences: {
      partition: GAME_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  const wc = gameView.webContents;

  wc.setWindowOpenHandler(({ url }) => {
    if (isHaxballUrl(url)) wc.loadURL(url).catch(() => {});
    else openExternalSafe(url);
    return { action: 'deny' };
  });
  const guard = (event, url) => {
    if (!isHaxballUrl(url)) {
      event.preventDefault();
      openExternalSafe(url);
    }
  };
  wc.on('will-navigate', guard);
  wc.on('will-redirect', guard);

  wc.on('did-start-loading', emitState);
  wc.on('did-stop-loading', emitState);
  wc.on('did-navigate', (_e, url) => { currentUrl = url; emitState(); });
  wc.on('did-navigate-in-page', (_e, url, isMainFrame) => { if (isMainFrame) { currentUrl = url; emitState(); } });
  wc.on('did-finish-load', () => {
    if (lastError) return;
    wc.setZoomFactor(settings.zoom);
    gameView.setVisible(wantVisible);
  });
  wc.on('did-fail-load', (_e, code, description, _url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = carga cancelada por una nueva navegación
    failGame(code, description);
  });
  wc.on('render-process-gone', () => failGame(0, 'El proceso del juego se cerró inesperadamente'));

  win.contentView.addChildView(gameView);
  gameView.setVisible(false);
  return gameView;
}

/* ---------- Ventana principal ---------- */

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 860,
    minHeight: 560,
    backgroundColor: '#000000',
    title: 'Kantinazo',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; gameView = null; });
  win.loadFile(path.join(__dirname, 'index.html'));
}

/* ---------- IPC (solo se atiende a la ventana de Kantinazo) ---------- */

const trusted = (event) => win && !win.isDestroyed() && event.sender === win.webContents;

ipcMain.handle('app:info', (event) => {
  if (!trusted(event)) return null;
  return { name: app.getName(), version: app.getVersion(), electron: process.versions.electron, chrome: process.versions.chrome };
});

ipcMain.handle('settings:get', (event) => (trusted(event) ? settings : null));

ipcMain.handle('settings:set', (event, patch) => {
  if (!trusted(event) || !patch || typeof patch !== 'object') return settings;
  settings = sanitizeSettings({ ...settings, ...patch, favorites: settings.favorites });
  saveSettings();
  if (gameView && !lastError) gameView.webContents.setZoomFactor(settings.zoom);
  return settings;
});

ipcMain.handle('favorites:add', (event, fav) => {
  if (!trusted(event) || !fav) return { ok: false, error: 'Solicitud no válida.' };
  const url = normalizeRoomUrl(fav.url);
  if (!url) return { ok: false, error: 'El enlace no es una sala de HaxBall. Tiene que empezar con https://www.haxball.com/play' };
  if (settings.favorites.some((f) => f.url === url)) return { ok: false, error: 'Esa sala ya está en tus favoritos.' };
  if (settings.favorites.length >= 200) return { ok: false, error: 'Llegaste al máximo de 200 favoritos.' };
  const name = String(fav.name || '').trim().slice(0, 60);
  if (!name) return { ok: false, error: 'Poné un nombre para reconocer la sala.' };
  settings.favorites.push({ id: crypto.randomUUID(), name, url, addedAt: Date.now() });
  saveSettings();
  return { ok: true, favorites: settings.favorites };
});

ipcMain.handle('favorites:remove', (event, id) => {
  if (!trusted(event)) return { ok: false };
  settings.favorites = settings.favorites.filter((f) => f.id !== id);
  saveSettings();
  return { ok: true, favorites: settings.favorites };
});

ipcMain.handle('game:show', (event, rect, url) => {
  if (!trusted(event)) return { ok: false };
  let target = null;
  if (url !== undefined && url !== null) {
    target = normalizeRoomUrl(url);
    if (!target) return { ok: false, error: 'El enlace no es una sala de HaxBall. Tiene que empezar con https://www.haxball.com/play' };
  }
  wantVisible = true;
  const view = ensureGameView();
  applyBounds(rect);
  if (target) loadGame(target);
  else if (!view.webContents.getURL() || lastError) loadGame(lastUrl);
  else { view.setVisible(true); emitState(); }
  return { ok: true };
});

ipcMain.on('game:bounds', (event, rect) => { if (trusted(event) && wantVisible) applyBounds(rect); });
ipcMain.on('game:hide', (event) => {
  if (!trusted(event)) return;
  wantVisible = false;
  if (gameView) gameView.setVisible(false);
});
ipcMain.on('game:home', (event) => { if (trusted(event)) { wantVisible = true; loadGame(PLAY_URL); } });
ipcMain.on('game:reload', (event) => {
  if (!trusted(event) || !gameView) return;
  if (lastError || !gameView.webContents.getURL()) loadGame(lastUrl);
  else gameView.webContents.reload();
});
ipcMain.on('game:external', (event) => { if (trusted(event)) openExternalSafe(currentUrl && isHaxballUrl(currentUrl) ? currentUrl : lastUrl); });

ipcMain.handle('game:clear-data', async (event) => {
  if (!trusted(event)) return { ok: false };
  const ses = session.fromPartition(GAME_PARTITION);
  await ses.clearStorageData();
  await ses.clearCache();
  if (gameView && gameView.webContents.getURL()) loadGame(PLAY_URL);
  return { ok: true };
});

/* ---------- Ciclo de vida ---------- */

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(() => {
    app.setAppUserModelId('com.kantinazo.app');
    Menu.setApplicationMenu(null);
    loadSettings();

    // Sin permisos de cámara, micrófono, ubicación, etc. Solo pantalla completa en el juego.
    session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
    session.fromPartition(GAME_PARTITION).setPermissionRequestHandler((_wc, perm, cb) => cb(perm === 'fullscreen'));

    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });

  app.on('window-all-closed', () => app.quit());
}
