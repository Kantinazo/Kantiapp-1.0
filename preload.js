'use strict';
// Puente mínimo y explícito entre la interfaz local y el proceso principal.
// Solo se carga en la ventana de Kantinazo, nunca en el sitio de HaxBall.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('kantinazo', {
  getInfo: () => ipcRenderer.invoke('app:info'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (patch) => ipcRenderer.invoke('settings:set', patch),
  addFavorite: (fav) => ipcRenderer.invoke('favorites:add', fav),
  removeFavorite: (id) => ipcRenderer.invoke('favorites:remove', id),
  game: {
    show: (rect, url) => ipcRenderer.invoke('game:show', rect, url),
    setBounds: (rect) => ipcRenderer.send('game:bounds', rect),
    hide: () => ipcRenderer.send('game:hide'),
    home: () => ipcRenderer.send('game:home'),
    reload: () => ipcRenderer.send('game:reload'),
    openExternal: () => ipcRenderer.send('game:external'),
    clearData: () => ipcRenderer.invoke('game:clear-data')
  },
  onGameState: (callback) => {
    const handler = (_event, state) => callback(state);
    ipcRenderer.on('game:state', handler);
    return () => ipcRenderer.removeListener('game:state', handler);
  }
});
