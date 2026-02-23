/**
 * FileWriter — Unified file I/O abstraction for Electron and Web File System Access API.
 *
 * Provides a single interface for writing/reading text files to a user-selected folder,
 * regardless of whether the app runs in Electron (Node.js fs) or the browser (File System Access API).
 */

export interface FileWriterHandle {
  writeFile(filename: string, content: string): Promise<void>
  readFile(filename: string): Promise<string | null>
  isAvailable(): boolean
}

// ── Electron Writer ──

export function createElectronWriter(folderPath: string): FileWriterHandle {
  const api = window.electronAPI
  return {
    async writeFile(filename: string, content: string) {
      if (!api) throw new Error('Electron API not available')
      const result = await api.writeProjectFile(folderPath, filename, content)
      if (!result.success) throw new Error(result.error || 'Write failed')
    },
    async readFile(filename: string): Promise<string | null> {
      if (!api) return null
      try {
        const result = await api.readProjectFile(folderPath, filename)
        if (result.success && result.data) return result.data
        return null
      } catch {
        return null
      }
    },
    isAvailable(): boolean {
      return !!api
    },
  }
}

// ── Web File System Access API Writer ──

export function createWebWriter(dirHandle: FileSystemDirectoryHandle): FileWriterHandle {
  return {
    async writeFile(filename: string, content: string) {
      const fileHandle = await dirHandle.getFileHandle(filename, { create: true })
      const writable = await (fileHandle as any).createWritable()
      await writable.write(content)
      await writable.close()
    },
    async readFile(filename: string): Promise<string | null> {
      try {
        const fileHandle = await dirHandle.getFileHandle(filename)
        const file = await fileHandle.getFile()
        return await file.text()
      } catch {
        return null
      }
    },
    isAvailable(): boolean {
      return true
    },
  }
}

// ── Helper: get writer for a given project ──

export function getFileWriter(project: { folderPath?: string; usesFolderStorage?: boolean }): FileWriterHandle | null {
  const api = window.electronAPI

  // Electron: use native file system
  if (api && project.folderPath) {
    return createElectronWriter(project.folderPath)
  }

  // Web: use File System Access API handle
  const dirHandle = (window as any).__onionFlowDirHandle as FileSystemDirectoryHandle | undefined
  if (dirHandle && project.usesFolderStorage) {
    return createWebWriter(dirHandle)
  }

  return null
}
