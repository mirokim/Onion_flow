/**
 * Database persistence helpers: IndexedDB load/save, auto-backup.
 * Extracted from SQLiteStorageAdapter.
 */

const SQLITE_DB_NAME = 'OnionSQLiteStore'
const SQLITE_STORE = 'databases'

export const SQLITE_KEY = 'onion-main-db'

export async function loadDatabaseFromIDB(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(SQLITE_DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(SQLITE_STORE)) {
          db.createObjectStore(SQLITE_STORE)
        }
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(SQLITE_STORE, 'readonly')
        const store = tx.objectStore(SQLITE_STORE)
        const getReq = store.get(SQLITE_KEY)
        getReq.onsuccess = () => resolve(getReq.result || null)
        getReq.onerror = () => resolve(null)
      }
      req.onerror = () => resolve(null)
    } catch { resolve(null) }
  })
}

export async function saveDatabaseToIDB(data: Uint8Array, key: string = SQLITE_KEY): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(SQLITE_DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(SQLITE_STORE)) {
          db.createObjectStore(SQLITE_STORE)
        }
      }
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(SQLITE_STORE, 'readwrite')
        tx.objectStore(SQLITE_STORE).put(data, key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => reject(new Error('IndexedDB transaction failed'))
      }
      req.onerror = () => reject(new Error('Failed to open IndexedDB'))
    } catch (err) { reject(err) }
  })
}

export async function deleteFromIDB(key: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(SQLITE_DB_NAME, 1)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(SQLITE_STORE, 'readwrite')
        tx.objectStore(SQLITE_STORE).delete(key)
        tx.oncomplete = () => resolve()
        tx.onerror = () => resolve()
      }
      req.onerror = () => resolve()
    } catch { resolve() }
  })
}

export function getAutoBackupKeys(): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(SQLITE_DB_NAME, 1)
      req.onsuccess = () => {
        const db = req.result
        const tx = db.transaction(SQLITE_STORE, 'readonly')
        const store = tx.objectStore(SQLITE_STORE)
        const getAllKeys = store.getAllKeys()
        getAllKeys.onsuccess = () => {
          const keys = (getAllKeys.result as string[])
            .filter(k => typeof k === 'string' && k.startsWith('onion-autobackup-'))
            .sort()
          resolve(keys)
        }
        getAllKeys.onerror = () => resolve([])
      }
      req.onerror = () => resolve([])
    } catch { resolve([]) }
  })
}
