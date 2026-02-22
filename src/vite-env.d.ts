/// <reference types="vite/client" />

export {}

declare global {
  interface FolderEntry {
    name: string
    isDirectory: boolean
  }

  interface ElectronAPI {
    isElectron: boolean
    platform: string
    showSaveDialog: (defaultName?: string) => Promise<string | null>
    showOpenDialog: () => Promise<string | null>
    writeDatabase: (filePath: string, data: Uint8Array) => Promise<{ success: boolean; error?: string }>
    readDatabase: (filePath: string) => Promise<{ success: boolean; data?: number[]; error?: string }>
    fileExists: (filePath: string) => Promise<boolean>

    // Node plugin directory (ComfyUI-style)
    getNodesDirectory: () => Promise<string>

    // Folder-based project operations
    selectFolder: () => Promise<string | null>
    createFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>
    listFolder: (folderPath: string) => Promise<{ success: boolean; data?: FolderEntry[]; error?: string }>
    writeProjectFile: (folderPath: string, filename: string, content: string) => Promise<{ success: boolean; error?: string }>
    readProjectFile: (folderPath: string, filename: string) => Promise<{ success: boolean; data?: string; error?: string }>
  }

  // Web File System Access API (Chrome/Edge)
  interface FilePickerAcceptType {
    description?: string
    accept: Record<string, string[]>
  }

  interface SaveFilePickerOptions {
    suggestedName?: string
    types?: FilePickerAcceptType[]
  }

  interface OpenFilePickerOptions {
    multiple?: boolean
    types?: FilePickerAcceptType[]
  }

  interface Window {
    electronAPI?: ElectronAPI
    showSaveFilePicker?: (options?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
    showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>
  }

  interface FileSystemFileHandle {
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>
  }
}
