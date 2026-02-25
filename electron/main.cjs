const { app, BrowserWindow, shell, ipcMain, dialog, session, safeStorage, net, nativeImage } = require('electron')
const path = require('path')
const fs = require('fs')

let mainWindow

// ── Security: Allowed API domains for CORS bypass ──
const ALLOWED_API_DOMAINS = [
  'api.openai.com',
  'api.anthropic.com',
  'generativelanguage.googleapis.com',
  'api.together.xyz',
  'api.x.ai',
]

// ── Security: Validate file path is a .onionflow file in a safe location ──
function isAllowedFilePath(filePath) {
  try {
    const resolved = path.resolve(filePath)
    const ext = path.extname(resolved).toLowerCase()
    if (ext !== '.onionflow') return false
    const blocked = ['/etc', '/usr', '/bin', '/sbin', '/var', '/tmp',
      'C:\\Windows', 'C:\\Program Files', 'C:\\ProgramData']
    for (const dir of blocked) {
      if (resolved.toLowerCase().startsWith(dir.toLowerCase())) return false
    }
    return true
  } catch {
    return false
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 600,
    title: 'ONION FLOW',
    icon: nativeImage.createFromPath(path.join(__dirname, '..', 'public', 'onion.png')),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
    autoHideMenuBar: true,
    backgroundColor: '#1e1e2e',
  })

  // ── Security: Handle CORS for allowed API domains ──
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const url = new URL(details.url)
    const isAllowed = ALLOWED_API_DOMAINS.some(d => url.hostname === d || url.hostname.endsWith('.' + d))
    if (isAllowed) {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'access-control-allow-origin': ['*'],
          'access-control-allow-headers': ['*'],
          'access-control-allow-methods': ['GET, POST, PUT, DELETE, OPTIONS'],
        },
      })
    } else {
      callback({ responseHeaders: details.responseHeaders })
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

// ── IPC Handlers for file-based project persistence ──

ipcMain.handle('file:showSaveDialog', async (_event, defaultName) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '프로젝트 저장 위치 선택',
    defaultPath: defaultName || 'untitled.onionflow',
    filters: [{ name: 'Onion Flow Project', extensions: ['onionflow'] }],
  })
  if (result.canceled) return null
  return result.filePath
})

ipcMain.handle('file:showOpenDialog', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '프로젝트 파일 열기',
    filters: [{ name: 'Onion Flow Project', extensions: ['onionflow'] }],
    properties: ['openFile'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('file:writeDatabase', async (_event, filePath, dataArray) => {
  try {
    if (!isAllowedFilePath(filePath)) {
      return { success: false, error: 'Access denied: only .onionflow files in user directories are allowed' }
    }
    const buffer = Buffer.from(dataArray)
    fs.writeFileSync(filePath, buffer)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('file:readDatabase', async (_event, filePath) => {
  try {
    if (!isAllowedFilePath(filePath)) {
      return { success: false, error: 'Access denied: only .onionflow files in user directories are allowed' }
    }
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }
    const buffer = fs.readFileSync(filePath)
    return { success: true, data: Array.from(new Uint8Array(buffer)) }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('file:exists', async (_event, filePath) => {
  if (!isAllowedFilePath(filePath)) return false
  return fs.existsSync(filePath)
})

// ── IPC: Node plugin directory (ComfyUI-style) ──

ipcMain.handle('file:getNodesDirectory', () => {
  const basePath = app.isPackaged
    ? path.dirname(app.getPath('exe'))
    : process.cwd()
  return path.join(basePath, 'onion_flow_nodes')
})

// ── IPC: Folder-based project operations ──

ipcMain.handle('file:selectFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '\ud504\ub85c\uc81d\ud2b8 \ud3f4\ub354 \uc120\ud0dd',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
})

ipcMain.handle('file:createFolder', async (_event, folderPath) => {
  try {
    fs.mkdirSync(folderPath, { recursive: true })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('file:listFolder', async (_event, folderPath) => {
  try {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder not found' }
    }
    const entries = fs.readdirSync(folderPath, { withFileTypes: true })
    return {
      success: true,
      data: entries.map(e => ({ name: e.name, isDirectory: e.isDirectory() })),
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('file:writeProjectFile', async (_event, folderPath, filename, content) => {
  try {
    const filePath = path.join(folderPath, filename)
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
    fs.writeFileSync(filePath, content, 'utf-8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('file:readProjectFile', async (_event, folderPath, filename) => {
  try {
    const filePath = path.join(folderPath, filename)
    if (!fs.existsSync(filePath)) {
      return { success: false, error: 'File not found' }
    }
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, data: content }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: Style Analyzer — URL fetch & text file open ──

ipcMain.handle('file:fetchUrl', async (_event, url) => {
  try {
    const res = await net.fetch(url, { bypassCustomProtocolHandlers: false })
    const text = await res.text()
    return { success: true, data: text }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('file:openTextFile', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '텍스트 파일 선택',
      filters: [{ name: 'Text Files', extensions: ['txt', 'md'] }],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const content = fs.readFileSync(filePath, 'utf-8')
    return { success: true, data: content, filename: path.basename(filePath) }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: safeStorage — OS-level encryption for API keys ──

ipcMain.handle('safe:isAvailable', () => {
  return safeStorage.isEncryptionAvailable()
})

ipcMain.handle('safe:encrypt', (_event, plainText) => {
  if (!safeStorage.isEncryptionAvailable()) return null
  const encrypted = safeStorage.encryptString(plainText)
  return encrypted.toString('base64')
})

ipcMain.handle('safe:decrypt', (_event, base64) => {
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    const buffer = Buffer.from(base64, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    return null
  }
})

// ── Single instance lock ──
const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })
}
