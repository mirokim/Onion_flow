const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // File dialog
  showSaveDialog: (defaultName) => ipcRenderer.invoke('file:showSaveDialog', defaultName),
  showOpenDialog: () => ipcRenderer.invoke('file:showOpenDialog'),

  // File system operations for .onionflow project files
  writeDatabase: (filePath, data) => ipcRenderer.invoke('file:writeDatabase', filePath, Array.from(data)),
  readDatabase: (filePath) => ipcRenderer.invoke('file:readDatabase', filePath),
  fileExists: (filePath) => ipcRenderer.invoke('file:exists', filePath),

  // Node plugin directory (ComfyUI-style)
  getNodesDirectory: () => ipcRenderer.invoke('file:getNodesDirectory'),

  // Folder-based project operations
  selectFolder: () => ipcRenderer.invoke('file:selectFolder'),
  createFolder: (folderPath) => ipcRenderer.invoke('file:createFolder', folderPath),
  listFolder: (folderPath) => ipcRenderer.invoke('file:listFolder', folderPath),
  writeProjectFile: (folderPath, filename, content) =>
    ipcRenderer.invoke('file:writeProjectFile', folderPath, filename, content),
  readProjectFile: (folderPath, filename) =>
    ipcRenderer.invoke('file:readProjectFile', folderPath, filename),

  // Safe storage — OS-level encryption for API keys
  safeStorageAvailable: () => ipcRenderer.invoke('safe:isAvailable'),
  safeEncrypt: (plainText) => ipcRenderer.invoke('safe:encrypt', plainText),
  safeDecrypt: (base64) => ipcRenderer.invoke('safe:decrypt', base64),
})
