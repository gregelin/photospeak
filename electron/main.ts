import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { spawn, exec } from 'child_process'
import * as path from 'path'
import * as fs from 'fs'

// Disable all network features - this app works entirely offline
app.commandLine.appendSwitch('disable-features', 'NetworkService')
app.commandLine.appendSwitch('disable-background-networking')
app.commandLine.appendSwitch('disable-component-update')
app.commandLine.appendSwitch('disable-domain-reliability')

let mainWindow: BrowserWindow | null = null

// Path to Swift helper
function getHelperPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'PhotoSpeakHelper')
  }
  return path.join(__dirname, '..', 'swift-helper', '.build', 'release', 'PhotoSpeakHelper')
}

// Execute Swift helper command
async function runHelper(command: string, args: string[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    const helperPath = getHelperPath()

    if (!fs.existsSync(helperPath)) {
      reject(new Error(`Helper not found at ${helperPath}. Build it first with: cd swift-helper && swift build -c release`))
      return
    }

    const proc = spawn(helperPath, [command, ...args])
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0) {
        try {
          resolve(JSON.parse(stdout))
        } catch {
          resolve(stdout)
        }
      } else {
        // Try to parse error from stdout (helper outputs JSON errors there)
        try {
          const errorObj = JSON.parse(stdout)
          if (errorObj.error) {
            reject(new Error(errorObj.error))
            return
          }
        } catch {}
        reject(new Error(stderr || `Helper exited with code ${code}`))
      }
    })

    proc.on('error', (err) => {
      reject(err)
    })
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false  // Disable spellcheck (can make network requests)
    },
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar'
  })

  // Block all external network requests
  mainWindow.webContents.session.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      // Allow localhost for dev server, block everything else
      if (details.url.startsWith('http://localhost') || details.url.startsWith('http://127.0.0.1')) {
        callback({})
      } else {
        console.log('Blocked network request:', details.url)
        callback({ cancel: true })
      }
    }
  )

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    // Uncomment to auto-open dev tools: mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

// IPC Handlers for Photos
ipcMain.handle('photos:getAlbums', async () => {
  try {
    return await runHelper('list-albums')
  } catch (err: any) {
    console.error('Failed to get albums:', err)
    throw err
  }
})

ipcMain.handle('photos:getPhotos', async (_, albumId?: string) => {
  try {
    const args = albumId ? [albumId] : []
    return await runHelper('list-photos', args)
  } catch (err: any) {
    console.error('Failed to get photos:', err)
    throw err
  }
})

// Fast metadata-only listing (no thumbnails)
ipcMain.handle('photos:getPhotosMeta', async (_, albumId?: string) => {
  try {
    const args = albumId ? [albumId] : []
    return await runHelper('list-photos-meta', args)
  } catch (err: any) {
    console.error('Failed to get photos meta:', err)
    throw err
  }
})

// Batch thumbnail loading
ipcMain.handle('photos:getThumbnails', async (_, photoIds: string[]) => {
  try {
    const idsArg = photoIds.join(',')
    return await runHelper('get-thumbnails', [idsArg])
  } catch (err: any) {
    console.error('Failed to get thumbnails:', err)
    throw err
  }
})

ipcMain.handle('photos:getPhoto', async (_, photoId: string) => {
  try {
    return await runHelper('get-photo', [photoId])
  } catch (err: any) {
    console.error('Failed to get photo:', err)
    throw err
  }
})

ipcMain.handle('photos:getThumbnail', async (_, photoId: string) => {
  try {
    return await runHelper('get-thumbnail', [photoId])
  } catch (err: any) {
    console.error('Failed to get thumbnail:', err)
    throw err
  }
})

// IPC Handlers for Audio
ipcMain.handle('audio:selectFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg'] }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle('audio:copyToStorage', async (_, sourcePath: string, photoId: string, clipId: string) => {
  const userDataPath = app.getPath('userData')
  const audioDir = path.join(userDataPath, 'audio')

  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true })
  }

  // Sanitize photoId - replace slashes with underscores
  const safePhotoId = photoId.replace(/\//g, '_')

  const ext = path.extname(sourcePath)
  const destPath = path.join(audioDir, `${safePhotoId}_${clipId}${ext}`)

  fs.copyFileSync(sourcePath, destPath)

  return destPath
})

ipcMain.handle('audio:saveRecording', async (_, photoId: string, base64Audio: string, clipId: string) => {
  const userDataPath = app.getPath('userData')
  const audioDir = path.join(userDataPath, 'audio')

  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true })
  }

  // Sanitize photoId - replace slashes with underscores
  const safePhotoId = photoId.replace(/\//g, '_')

  // Save as webm (the format from MediaRecorder)
  const destPath = path.join(audioDir, `${safePhotoId}_${clipId}.webm`)
  const buffer = Buffer.from(base64Audio, 'base64')
  fs.writeFileSync(destPath, buffer)

  return destPath
})

ipcMain.handle('app:getUserDataPath', () => {
  return app.getPath('userData')
})

ipcMain.handle('audio:loadFile', async (_, filePath: string) => {
  try {
    const buffer = fs.readFileSync(filePath)
    const base64 = buffer.toString('base64')
    const ext = path.extname(filePath).slice(1) || 'webm'
    return `data:audio/${ext};base64,${base64}`
  } catch (err) {
    console.error('Failed to load audio file:', err)
    return null
  }
})

ipcMain.handle('app:openPhotosSettings', () => {
  // Open System Preferences to Photos privacy settings
  exec('open "x-apple.systempreferences:com.apple.preference.security?Privacy_Photos"')
})

ipcMain.handle('app:reload', () => {
  mainWindow?.reload()
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
