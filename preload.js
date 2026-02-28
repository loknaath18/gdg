const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectImage: () => ipcRenderer.invoke('select-image'),
    logAction: (actionType, description) => ipcRenderer.send('log-action', actionType, description),
    getLogs: () => ipcRenderer.invoke('get-logs'),
    saveCapturedFrame: (base64Data) => ipcRenderer.invoke('save-captured-frame', base64Data)
});
