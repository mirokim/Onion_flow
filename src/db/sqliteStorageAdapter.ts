/**
 * SQLite-based StorageAdapter using sql.js (WASM).
 * Persists the database to IndexedDB automatically — no user permission required.
 */
import type { Database, SqlJsStatic } from 'sql.js'

/** Load sql.js with dynamic import to handle CJS/ESM interop */
async function loadSqlJs(): Promise<SqlJsStatic> {
  const sqlPromise = await import('sql.js')
  const initSqlJs = sqlPromise.default || sqlPromise

  // Build the correct WASM URL based on environment
  const wasmUrl = (() => {
    if (import.meta.env.DEV) {
      // Vite dev server serves public/ files at root
      return '/sql-wasm.wasm'
    }
    // Production: use URL relative to the current script/page
    // new URL works with both http:// and file:// protocols
    return new URL('./sql-wasm.wasm', window.location.href).href
  })()

  return initSqlJs({
    locateFile: () => wasmUrl,
  })
}

import type {
  Project, Chapter, Character, CharacterRelation,
  WorldSetting, Foreshadow, Item, ReferenceData,
  EntityVersion, AIConversation, AIMessage, AIProvider, OnionNode,
  CanvasNode, CanvasWire, WikiEntry, EmotionLog, StorySummary, DailyStats, TimelineSnapshot,
} from '@/types'
import type { StorageAdapter } from './storageAdapter'
import { sanitizeRecord } from './backup'

// ── IndexedDB helpers for SQLite database persistence ──

const SQLITE_DB_NAME = 'OnionSQLiteStore'
const SQLITE_STORE = 'databases'
const SQLITE_KEY = 'onion-main-db'

async function loadDatabaseFromIDB(): Promise<Uint8Array | null> {
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

async function saveDatabaseToIDB(data: Uint8Array, key: string = SQLITE_KEY): Promise<void> {
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

async function deleteFromIDB(key: string): Promise<void> {
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

// ── SQLiteStorageAdapter ──

export class SQLiteStorageAdapter implements StorageAdapter {
  private db: Database | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false
  private DEBOUNCE_MS = 500
  private initialized = false
  /** File path for Electron file-based persistence (null = use IndexedDB fallback) */
  private _filePath: string | null = null
  /** Web File System Access API handle for browser file-based persistence */
  private _fileHandle: FileSystemFileHandle | null = null

  get filePath(): string | null { return this._filePath }
  get fileHandle(): FileSystemFileHandle | null { return this._fileHandle }

  private _isElectron(): boolean {
    return !!window.electronAPI?.isElectron
  }

  /** Register page lifecycle handlers for data safety */
  private _registerLifecycleHandlers(): void {
    // Save on page unload (best-effort sync persist)
    window.addEventListener('beforeunload', () => {
      if (this.dirty && this.db) {
        this._persistSync()
      }
    })
    // Also persist when page becomes hidden (more reliable than beforeunload
    // because the page is still alive during visibilitychange, so async
    // operations can complete).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.dirty && this.db) {
        this._persist()
      }
    })
  }

  // ── Init ──

  /** Initialize: load from file (Electron) or IndexedDB (web fallback) */
  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    const SQL = await loadSqlJs()

    // Try to load from IndexedDB as web fallback
    const savedData = await loadDatabaseFromIDB()
    if (savedData) {
      try {
        this.db = new SQL.Database(savedData)
        console.log('[SQLite] Loaded existing database from IndexedDB')
      } catch (err) {
        console.warn('[SQLite] Failed to load saved database, creating new one:', err)
        this.db = new SQL.Database()
      }
    } else {
      this.db = new SQL.Database()
      console.log('[SQLite] Created new database')
    }

    this._createTables()
    await this._persist()

    this.startAutoBackup()
    this._registerLifecycleHandlers()
  }

  /** Initialize from a .onion file on disk (Electron only) */
  async initFromFile(filePath: string): Promise<void> {
    const api = window.electronAPI
    if (!api) throw new Error('Electron API not available')

    const SQL = await loadSqlJs()
    const result = await api.readDatabase(filePath)
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to read file')
    }

    const data = new Uint8Array(result.data)
    if (this.db) this.db.close()
    this.db = new SQL.Database(data)
    this._filePath = filePath
    this.initialized = true

    this._createTables()
    console.log('[SQLite] Loaded database from file:', filePath)

    this.startAutoBackup()
    this._registerLifecycleHandlers()
  }

  /** Initialize a brand new empty database and save to file (Electron only) */
  async initNewFile(filePath: string): Promise<void> {
    const SQL = await loadSqlJs()

    if (this.db) this.db.close()
    this.db = new SQL.Database()
    this._filePath = filePath
    this.initialized = true

    this._createTables()
    await this._persist()
    console.log('[SQLite] Created new database at file:', filePath)

    this.startAutoBackup()
    this._registerLifecycleHandlers()
  }

  /** Initialize from a web FileSystemFileHandle (File System Access API) */
  async initFromFileHandle(handle: FileSystemFileHandle): Promise<void> {
    const SQL = await loadSqlJs()
    const file = await handle.getFile()
    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    if (this.db) this.db.close()
    this.db = new SQL.Database(data)
    this._fileHandle = handle
    this.initialized = true

    this._createTables()
    console.log('[SQLite] Loaded database from web file handle:', handle.name)

    this.startAutoBackup()
    this._registerLifecycleHandlers()
  }

  /** Initialize a brand new empty database with a web FileSystemFileHandle */
  async initNewFileHandle(handle: FileSystemFileHandle): Promise<void> {
    const SQL = await loadSqlJs()

    if (this.db) this.db.close()
    this.db = new SQL.Database()
    this._fileHandle = handle
    this.initialized = true

    this._createTables()
    await this._persist()
    console.log('[SQLite] Created new database with web file handle:', handle.name)

    this.startAutoBackup()
    this._registerLifecycleHandlers()
  }

  /** Reset adapter state so a different file can be loaded */
  reset(): void {
    this.stopAutoBackup()
    if (this.saveTimer) clearTimeout(this.saveTimer)
    if (this.db) this.db.close()
    this.db = null
    this._filePath = null
    this._fileHandle = null
    this.initialized = false
    this.dirty = false
  }

  private _createTables() {
    if (!this.db) return

    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        genre TEXT NOT NULL DEFAULT '',
        synopsis TEXT NOT NULL DEFAULT '',
        settings TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS chapters (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        "order" INTEGER NOT NULL DEFAULT 0,
        parent_id TEXT,
        type TEXT NOT NULL DEFAULT 'chapter',
        content TEXT,
        synopsis TEXT NOT NULL DEFAULT '',
        word_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        aliases TEXT NOT NULL DEFAULT '[]',
        role TEXT NOT NULL DEFAULT 'supporting',
        personality TEXT NOT NULL DEFAULT '',
        abilities TEXT NOT NULL DEFAULT '',
        appearance TEXT NOT NULL DEFAULT '',
        background TEXT NOT NULL DEFAULT '',
        motivation TEXT NOT NULL DEFAULT '',
        speech_pattern TEXT NOT NULL DEFAULT '',
        image_url TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS character_relations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        relation_type TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        is_bidirectional INTEGER NOT NULL DEFAULT 1,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_relations_project ON character_relations(project_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_relations_source ON character_relations(source_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_relations_target ON character_relations(target_id)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS world_settings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_world_settings_project ON world_settings(project_id)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS items (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        item_type TEXT NOT NULL DEFAULT 'other',
        rarity TEXT NOT NULL DEFAULT 'common',
        effect TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        owner TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS reference_data (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'reference',
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        source_url TEXT NOT NULL DEFAULT '',
        attachments TEXT NOT NULL DEFAULT '[]',
        tags TEXT NOT NULL DEFAULT '[]',
        use_as_context INTEGER NOT NULL DEFAULT 1,
        notes TEXT NOT NULL DEFAULT '',
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_reference_data_project ON reference_data(project_id)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS foreshadows (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'planted',
        planted_chapter_id TEXT,
        resolved_chapter_id TEXT,
        importance TEXT NOT NULL DEFAULT 'medium',
        tags TEXT NOT NULL DEFAULT '[]',
        notes TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_foreshadows_project ON foreshadows(project_id)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS entity_versions (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version_number INTEGER NOT NULL DEFAULT 0,
        data TEXT NOT NULL DEFAULT '{}',
        label TEXT NOT NULL DEFAULT '',
        created_by TEXT NOT NULL DEFAULT 'user',
        created_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_entity_versions_project ON entity_versions(project_id)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        messages TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL DEFAULT 0,
        used_providers TEXT NOT NULL DEFAULT '[]',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_ai_conversations_project ON ai_conversations(project_id)`)

    this.db.run(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        content TEXT NOT NULL DEFAULT '',
        provider TEXT,
        tool_calls TEXT,
        tool_results TEXT,
        attachments TEXT,
        timestamp INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id)`)

    // Onion nodes (separate from chapter content)
    this.db.run(`
      CREATE TABLE IF NOT EXISTS onion_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        parent_id TEXT,
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_onion_nodes_project ON onion_nodes(project_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_onion_nodes_chapter ON onion_nodes(chapter_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_onion_nodes_parent ON onion_nodes(parent_id)`)

    // ── Onion Flow: Canvas Nodes ──
    this.db.run(`
      CREATE TABLE IF NOT EXISTS canvas_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_canvas_id TEXT,
        type TEXT NOT NULL DEFAULT 'storyteller',
        position_x REAL NOT NULL DEFAULT 0,
        position_y REAL NOT NULL DEFAULT 0,
        data TEXT NOT NULL DEFAULT '{}',
        width REAL,
        height REAL,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_canvas_nodes_project ON canvas_nodes(project_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_canvas_nodes_parent ON canvas_nodes(parent_canvas_id)`)

    // ── Onion Flow: Canvas Wires ──
    this.db.run(`
      CREATE TABLE IF NOT EXISTS canvas_wires (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        parent_canvas_id TEXT,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        source_handle TEXT NOT NULL DEFAULT 'output',
        target_handle TEXT NOT NULL DEFAULT 'input',
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_canvas_wires_project ON canvas_wires(project_id)`)

    // ── Onion Flow: Wiki Entries ──
    this.db.run(`
      CREATE TABLE IF NOT EXISTS wiki_entries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        title TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        tags TEXT NOT NULL DEFAULT '[]',
        linked_entity_id TEXT,
        linked_entity_type TEXT,
        "order" INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_wiki_entries_project ON wiki_entries(project_id)`)

    // ── Onion Flow: Emotion Logs ──
    this.db.run(`
      CREATE TABLE IF NOT EXISTS emotion_logs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        character_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        emotion TEXT NOT NULL DEFAULT '',
        intensity INTEGER NOT NULL DEFAULT 0,
        timestamp INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_emotion_logs_project ON emotion_logs(project_id)`)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_emotion_logs_character ON emotion_logs(character_id)`)

    // ── Onion Flow: Story Summaries ──
    this.db.run(`
      CREATE TABLE IF NOT EXISTS story_summaries (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        chapter_id TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        active_hooks TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_story_summaries_project ON story_summaries(project_id)`)

    // ── Onion Flow: Daily Stats ──
    this.db.run(`
      CREATE TABLE IF NOT EXISTS daily_stats (
        date TEXT NOT NULL,
        project_id TEXT NOT NULL,
        words_written INTEGER NOT NULL DEFAULT 0,
        time_spent_min INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (date, project_id),
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_daily_stats_project ON daily_stats(project_id)`)

    // ── Onion Flow: Timeline Snapshots ──
    this.db.run(`
      CREATE TABLE IF NOT EXISTS timeline_snapshots (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        canvas_data TEXT NOT NULL DEFAULT '{}',
        manuscript_data TEXT NOT NULL DEFAULT '[]',
        wiki_data TEXT NOT NULL DEFAULT '[]',
        world_data TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
    `)
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_timeline_snapshots_project ON timeline_snapshots(project_id)`)

    // Foreign key enforcement (WAL mode removed: not needed in WASM)
    this.db.run(`PRAGMA foreign_keys=ON`)

    // ── Schema migration ──
    this._runMigrations()
  }

  private _runMigrations(): void {
    if (!this.db) return

    // Create migration tracking table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at INTEGER NOT NULL DEFAULT 0
      )
    `)

    const applied = new Set(
      this._queryAll<{ name: string }>('SELECT name FROM _migrations').map(r => r.name)
    )

    const migrations: Array<{ name: string; sql: string[] }> = [
      // Future migrations go here, e.g.:
      // {
      //   name: '001_add_sync_fields',
      //   sql: [
      //     'ALTER TABLE projects ADD COLUMN sync_status TEXT DEFAULT "local_only"',
      //     'ALTER TABLE projects ADD COLUMN server_version INTEGER DEFAULT 0',
      //   ],
      // },
    ]

    for (const migration of migrations) {
      if (applied.has(migration.name)) continue
      try {
        for (const sql of migration.sql) {
          this.db.run(sql)
        }
        this._run(
          'INSERT INTO _migrations (name, applied_at) VALUES (?, ?)',
          [migration.name, Date.now()]
        )
      } catch (err) {
        console.error(`[SQLite] Migration '${migration.name}' failed:`, err)
      }
    }
  }

  // ── Persistence ──

  private _persisting = false

  private _markDirty() {
    this.dirty = true
    this._scheduleSave()
  }

  private _scheduleSave() {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this._persist(), this.DEBOUNCE_MS)
  }

  private async _persist(): Promise<void> {
    // Prevent concurrent file writes (File System Access API allows only one writable at a time)
    if (this._persisting) {
      this.dirty = true
      return
    }
    this._persisting = true
    try {
      await this._doPersist()
    } catch (err) {
      // If persist failed, mark dirty so it will be retried
      this.dirty = true
      console.error('[SQLite] Persist failed, will retry:', err)
    } finally {
      this._persisting = false
      // If marked dirty again during persist (or on failure), schedule another save
      if (this.dirty) this._scheduleSave()
    }
  }

  private async _doPersist(): Promise<void> {
    if (!this.db) return
    this.dirty = false
    const data = this.db.export()

    // Electron file-based persistence
    if (this._filePath && this._isElectron()) {
      const result = await window.electronAPI!.writeDatabase(this._filePath, data)
      if (!result.success) {
        console.error('[SQLite] Failed to save to file:', result.error)
      }
      return
    }

    // Web File System Access API persistence
    if (this._fileHandle) {
      try {
        const writable = await this._fileHandle.createWritable()
        await writable.write(new Uint8Array(data) as BlobPart)
        await writable.close()
      } catch (err) {
        console.error('[SQLite] Failed to save via File System Access API:', err)
        // Clear stale file handle to prevent repeated errors
        this._fileHandle = null
        // Fall back to IndexedDB if file write fails
        await saveDatabaseToIDB(data)
      }
      return
    }

    // Web fallback: IndexedDB
    await saveDatabaseToIDB(data)
  }

  private _persistSync(): void {
    // Best-effort save for beforeunload
    if (!this.db) return
    this.dirty = false
    const data = this.db.export()

    // Electron file-based persistence (async but best-effort)
    if (this._filePath && this._isElectron()) {
      window.electronAPI!.writeDatabase(this._filePath, data)
      return
    }

    // Web File System Access API (async but best-effort)
    if (this._fileHandle) {
      this._fileHandle.createWritable().then(async (writable) => {
        await writable.write(new Uint8Array(data) as BlobPart)
        await writable.close()
      }).catch(() => saveDatabaseToIDB(data))
      return
    }

    // Web fallback: IndexedDB
    saveDatabaseToIDB(data)
  }

  /**
   * Public synchronous persist — for use by editors in beforeunload/visibilitychange
   * handlers to ensure the latest in-memory SQLite state is written to IndexedDB/file.
   */
  persistSync(): void {
    if (this.dirty && this.db) {
      this._persistSync()
    }
  }

  /** Force immediate save */
  async saveNow(): Promise<boolean> {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null }
    await this._persist()
    return true
  }

  /** Export the entire SQLite database as a downloadable .db file */
  exportToFile(filename?: string): void {
    if (!this.db) return
    const data = this.db.export()
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/x-sqlite3' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename || `onion-editor-${new Date().toISOString().slice(0, 10)}.db`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 5000)
  }

  /** Import a SQLite .db file, replacing the current database */
  async importFromFile(file: File): Promise<boolean> {
    try {
      const SQL = await loadSqlJs()
      const buffer = await file.arrayBuffer()
      const data = new Uint8Array(buffer)
      const newDb = new SQL.Database(data)

      // Validate: check that the projects table exists
      try {
        newDb.exec('SELECT count(*) FROM projects')
      } catch {
        newDb.close()
        throw new Error('Invalid database file: missing projects table')
      }

      // Replace current database
      if (this.db) this.db.close()
      this.db = newDb
      this._createTables() // Ensure any missing tables are added
      await this._persist()
      return true
    } catch (err) {
      console.error('[SQLite] Failed to import database file:', err)
      return false
    }
  }

  // ── Row helpers ──

  private _queryAll<T>(sql: string, params: any[] = []): T[] {
    if (!this.db) return []
    const stmt = this.db.prepare(sql)
    stmt.bind(params)
    const results: T[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T)
    }
    stmt.free()
    return results
  }

  private _queryOne<T>(sql: string, params: any[] = []): T | null {
    const results = this._queryAll<T>(sql, params)
    return results[0] ?? null
  }

  private _run(sql: string, params: any[] = []): void {
    if (!this.db) {
      console.error('[SQLite] _run called but db is null. SQL:', sql.slice(0, 60))
      throw new Error('Database not initialized')
    }
    // Use prepare/bind/step instead of db.run() to avoid parameter binding issues in sql.js WASM
    const stmt = this.db.prepare(sql)
    if (params.length > 0) stmt.bind(params)
    stmt.step()
    stmt.free()
    this._markDirty()
  }

  /**
   * Execute a function within a SQLite transaction.
   * Commits on success, rolls back on error.
   * Prevents partial state when multiple operations must succeed together.
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.db) throw new Error('Database not initialized')
    this.db.run('BEGIN TRANSACTION')
    try {
      const result = await fn()
      this.db.run('COMMIT')
      return result
    } catch (err) {
      this.db.run('ROLLBACK')
      throw err
    }
  }

  // ── Row mapping: DB row → TypeScript object ──

  private _rowToProject(r: any): Project {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      genre: r.genre,
      synopsis: r.synopsis,
      settings: JSON.parse(r.settings || '{}'),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  private _rowToChapter(r: any): Chapter {
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      order: r.order,
      parentId: r.parent_id || null,
      type: r.type,
      content: r.content ? JSON.parse(r.content) : null,
      synopsis: r.synopsis,
      wordCount: r.word_count,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  /** Safely parse a JSON-encoded array column, always returning an array */
  private _parseJsonArray<T = any>(raw: unknown, fallback: T[] = []): T[] {
    if (Array.isArray(raw)) return raw
    if (typeof raw !== 'string' || !raw) return fallback
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : fallback
    } catch {
      // Fallback: for string[] columns, treat as comma-separated string
      return raw.split(',').map(s => s.trim()).filter(Boolean) as unknown as T[]
    }
  }

  private _rowToCharacter(r: any): Character {
    return {
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      aliases: this._parseJsonArray<string>(r.aliases),
      role: r.role,
      personality: r.personality,
      abilities: r.abilities,
      appearance: r.appearance,
      background: r.background,
      motivation: r.motivation,
      speechPattern: r.speech_pattern,
      imageUrl: r.image_url,
      tags: this._parseJsonArray<string>(r.tags),
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  private _rowToRelation(r: any): CharacterRelation {
    return {
      id: r.id,
      projectId: r.project_id,
      sourceId: r.source_id,
      targetId: r.target_id,
      relationType: r.relation_type,
      description: r.description,
      isBidirectional: !!r.is_bidirectional,
    }
  }

  private _rowToWorldSetting(r: any): WorldSetting {
    return {
      id: r.id,
      projectId: r.project_id,
      category: r.category,
      title: r.title,
      content: r.content,
      tags: this._parseJsonArray<string>(r.tags),
      order: r.order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  private _rowToItem(r: any): Item {
    return {
      id: r.id,
      projectId: r.project_id,
      name: r.name,
      itemType: r.item_type,
      rarity: r.rarity,
      effect: r.effect,
      description: r.description,
      owner: r.owner,
      tags: this._parseJsonArray<string>(r.tags),
      notes: r.notes,
      order: r.order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  private _rowToReferenceData(r: any): ReferenceData {
    return {
      id: r.id,
      projectId: r.project_id,
      category: r.category,
      title: r.title,
      content: r.content,
      sourceUrl: r.source_url,
      attachments: this._parseJsonArray(r.attachments),
      tags: this._parseJsonArray<string>(r.tags),
      useAsContext: !!r.use_as_context,
      notes: r.notes,
      order: r.order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  private _rowToForeshadow(r: any): Foreshadow {
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      description: r.description,
      status: r.status,
      plantedChapterId: r.planted_chapter_id || null,
      resolvedChapterId: r.resolved_chapter_id || null,
      importance: r.importance,
      tags: this._parseJsonArray<string>(r.tags),
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  private _rowToEntityVersion(r: any): EntityVersion {
    return {
      id: r.id,
      projectId: r.project_id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      versionNumber: r.version_number,
      data: JSON.parse(r.data || '{}'),
      label: r.label,
      createdBy: r.created_by,
      createdAt: r.created_at,
    }
  }

  private _rowToConversation(r: any): AIConversation {
    return {
      id: r.id,
      projectId: r.project_id,
      title: r.title,
      messages: this._parseJsonArray(r.messages),
      createdAt: r.created_at,
      usedProviders: this._parseJsonArray<AIProvider>(r.used_providers),
    }
  }

  private _rowToMessage(r: any): AIMessage & { conversationId: string } {
    return {
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      provider: r.provider || undefined,
      toolCalls: r.tool_calls ? this._parseJsonArray(r.tool_calls) : undefined,
      toolResults: r.tool_results ? this._parseJsonArray(r.tool_results) : undefined,
      attachments: r.attachments ? this._parseJsonArray(r.attachments) : undefined,
      timestamp: r.timestamp,
    }
  }

  private _rowToOnionNode(r: any): OnionNode {
    return {
      id: r.id,
      projectId: r.project_id,
      chapterId: r.chapter_id,
      parentId: r.parent_id || null,
      title: r.title,
      content: r.content,
      order: r.order,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  }

  // ── StorageAdapter: Projects ──

  async fetchProjects(): Promise<Project[]> {
    return this._queryAll('SELECT * FROM projects ORDER BY updated_at DESC').map(r => this._rowToProject(r))
  }

  async fetchProject(id: string): Promise<Project | null> {
    const r = this._queryOne('SELECT * FROM projects WHERE id = ?', [id])
    return r ? this._rowToProject(r) : null
  }

  async insertProject(project: Project): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO projects (id, title, description, genre, synopsis, settings, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [project.id, project.title, project.description, project.genre, project.synopsis,
       JSON.stringify(project.settings), project.createdAt, project.updatedAt]
    )
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<void> {
    const existing = await this.fetchProject(id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    await this.insertProject(merged)
  }

  async deleteProject(id: string): Promise<void> {
    // Delete all related data first (in case foreign keys aren't cascading in WASM)
    this._run('DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE project_id = ?)', [id])
    this._run('DELETE FROM ai_conversations WHERE project_id = ?', [id])
    this._run('DELETE FROM entity_versions WHERE project_id = ?', [id])
    this._run('DELETE FROM foreshadows WHERE project_id = ?', [id])
    this._run('DELETE FROM reference_data WHERE project_id = ?', [id])
    this._run('DELETE FROM items WHERE project_id = ?', [id])
    this._run('DELETE FROM world_settings WHERE project_id = ?', [id])
    this._run('DELETE FROM character_relations WHERE project_id = ?', [id])
    this._run('DELETE FROM characters WHERE project_id = ?', [id])
    this._run('DELETE FROM chapters WHERE project_id = ?', [id])
    this._run('DELETE FROM projects WHERE id = ?', [id])
  }

  // ── StorageAdapter: Chapters ──

  async fetchChapters(projectId: string): Promise<Chapter[]> {
    return this._queryAll('SELECT * FROM chapters WHERE project_id = ? ORDER BY "order"', [projectId])
      .map(r => this._rowToChapter(r))
  }

  async fetchChapter(id: string): Promise<Chapter | null> {
    const r = this._queryOne('SELECT * FROM chapters WHERE id = ?', [id])
    return r ? this._rowToChapter(r) : null
  }

  async insertChapter(chapter: Chapter): Promise<void> {
    if (!chapter.projectId) {
      throw new Error('insertChapter: projectId is required')
    }
    this._run(
      `INSERT OR REPLACE INTO chapters (id, project_id, title, "order", parent_id, type, content, synopsis, word_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [chapter.id, chapter.projectId, chapter.title, chapter.order, chapter.parentId,
       chapter.type, chapter.content ? JSON.stringify(chapter.content) : null,
       chapter.synopsis, chapter.wordCount, chapter.createdAt, chapter.updatedAt]
    )
  }

  async updateChapter(id: string, updates: Partial<Chapter>): Promise<void> {
    const existing = await this.fetchChapter(id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    await this.insertChapter(merged)
  }

  async deleteChapter(id: string): Promise<void> {
    this._run('DELETE FROM chapters WHERE id = ?', [id])
  }

  async deleteChaptersByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM chapters WHERE project_id = ?', [projectId])
  }

  // ── StorageAdapter: Characters ──

  async fetchCharacters(projectId: string): Promise<Character[]> {
    return this._queryAll('SELECT * FROM characters WHERE project_id = ?', [projectId])
      .map(r => this._rowToCharacter(r))
  }

  async insertCharacter(character: Character): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO characters (id, project_id, name, aliases, role, personality, abilities, appearance, background, motivation, speech_pattern, image_url, tags, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [character.id, character.projectId, character.name, JSON.stringify(character.aliases),
       character.role, character.personality, character.abilities, character.appearance,
       character.background, character.motivation, character.speechPattern, character.imageUrl,
       JSON.stringify(character.tags), character.notes, character.createdAt, character.updatedAt]
    )
  }

  async updateCharacter(id: string, updates: Partial<Character>): Promise<void> {
    const existing = await this.fetchCharacter(id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    await this.insertCharacter(merged)
  }

  async deleteCharacter(id: string): Promise<void> {
    this._run('DELETE FROM characters WHERE id = ?', [id])
  }

  private async fetchCharacter(id: string): Promise<Character | null> {
    const r = this._queryOne('SELECT * FROM characters WHERE id = ?', [id])
    return r ? this._rowToCharacter(r) : null
  }

  // ── StorageAdapter: Relations ──

  async fetchRelations(projectId: string): Promise<CharacterRelation[]> {
    return this._queryAll('SELECT * FROM character_relations WHERE project_id = ?', [projectId])
      .map(r => this._rowToRelation(r))
  }

  async insertRelation(relation: CharacterRelation): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO character_relations (id, project_id, source_id, target_id, relation_type, description, is_bidirectional)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [relation.id, relation.projectId, relation.sourceId, relation.targetId,
       relation.relationType, relation.description, relation.isBidirectional ? 1 : 0]
    )
  }

  async updateRelation(id: string, updates: Partial<CharacterRelation>): Promise<void> {
    const r = this._queryOne('SELECT * FROM character_relations WHERE id = ?', [id])
    if (!r) return
    const existing = this._rowToRelation(r)
    const merged = { ...existing, ...updates }
    await this.insertRelation(merged)
  }

  async deleteRelation(id: string): Promise<void> {
    this._run('DELETE FROM character_relations WHERE id = ?', [id])
  }

  async deleteRelationsByCharacter(characterId: string): Promise<void> {
    this._run('DELETE FROM character_relations WHERE source_id = ? OR target_id = ?', [characterId, characterId])
  }

  // ── Bulk delete by project (for backup restore) ──

  async deleteCharactersByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM characters WHERE project_id = ?', [projectId])
  }

  async deleteRelationsByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM character_relations WHERE project_id = ?', [projectId])
  }

  /** Clear foreshadow chapter references when a chapter is deleted */
  async clearForeshadowChapterRefs(chapterId: string): Promise<void> {
    this._run(
      'UPDATE foreshadows SET planted_chapter_id = NULL WHERE planted_chapter_id = ?',
      [chapterId]
    )
    this._run(
      'UPDATE foreshadows SET resolved_chapter_id = NULL WHERE resolved_chapter_id = ?',
      [chapterId]
    )
  }

  /** Remove relations that reference non-existent characters (orphan cleanup) */
  async cleanOrphanedRelations(projectId: string): Promise<number> {
    const relations = await this.fetchRelations(projectId)
    const characters = await this.fetchCharacters(projectId)
    const charIds = new Set(characters.map(c => c.id))
    let cleaned = 0
    for (const rel of relations) {
      if (!charIds.has(rel.sourceId) || !charIds.has(rel.targetId)) {
        this._run('DELETE FROM character_relations WHERE id = ?', [rel.id])
        cleaned++
      }
    }
    return cleaned
  }

  async deleteWorldSettingsByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM world_settings WHERE project_id = ?', [projectId])
  }

  async deleteForeshadowsByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM foreshadows WHERE project_id = ?', [projectId])
  }

  async deleteItemsByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM items WHERE project_id = ?', [projectId])
  }

  async deleteReferenceDataByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM reference_data WHERE project_id = ?', [projectId])
  }

  async deleteVersionsByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM entity_versions WHERE project_id = ?', [projectId])
  }

  // ── StorageAdapter: World Settings ──

  async fetchWorldSettings(projectId: string): Promise<WorldSetting[]> {
    return this._queryAll('SELECT * FROM world_settings WHERE project_id = ? ORDER BY "order"', [projectId])
      .map(r => this._rowToWorldSetting(r))
  }

  async insertWorldSetting(ws: WorldSetting): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO world_settings (id, project_id, category, title, content, tags, "order", created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ws.id, ws.projectId, ws.category, ws.title, ws.content,
       JSON.stringify(ws.tags), ws.order, ws.createdAt, ws.updatedAt]
    )
  }

  async updateWorldSetting(id: string, updates: Partial<WorldSetting>): Promise<void> {
    const r = this._queryOne('SELECT * FROM world_settings WHERE id = ?', [id])
    if (!r) return
    const existing = this._rowToWorldSetting(r)
    const merged = { ...existing, ...updates }
    await this.insertWorldSetting(merged)
  }

  async deleteWorldSetting(id: string): Promise<void> {
    this._run('DELETE FROM world_settings WHERE id = ?', [id])
  }

  // ── StorageAdapter: Items ──

  async fetchItems(projectId: string): Promise<Item[]> {
    return this._queryAll('SELECT * FROM items WHERE project_id = ? ORDER BY "order"', [projectId])
      .map(r => this._rowToItem(r))
  }

  async insertItem(item: Item): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO items (id, project_id, name, item_type, rarity, effect, description, owner, tags, notes, "order", created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [item.id, item.projectId, item.name, item.itemType, item.rarity,
       item.effect, item.description, item.owner, JSON.stringify(item.tags),
       item.notes, item.order, item.createdAt, item.updatedAt]
    )
  }

  async updateItem(id: string, updates: Partial<Item>): Promise<void> {
    const r = this._queryOne('SELECT * FROM items WHERE id = ?', [id])
    if (!r) return
    const existing = this._rowToItem(r)
    const merged = { ...existing, ...updates }
    await this.insertItem(merged)
  }

  async deleteItem(id: string): Promise<void> {
    this._run('DELETE FROM items WHERE id = ?', [id])
  }

  // ── StorageAdapter: Reference Data ──

  async fetchReferenceData(projectId: string): Promise<ReferenceData[]> {
    return this._queryAll('SELECT * FROM reference_data WHERE project_id = ? ORDER BY "order"', [projectId])
      .map(r => this._rowToReferenceData(r))
  }

  async insertReferenceData(ref: ReferenceData): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO reference_data (id, project_id, category, title, content, source_url, attachments, tags, use_as_context, notes, "order", created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [ref.id, ref.projectId, ref.category, ref.title, ref.content, ref.sourceUrl,
       JSON.stringify(ref.attachments), JSON.stringify(ref.tags),
       ref.useAsContext ? 1 : 0, ref.notes, ref.order, ref.createdAt, ref.updatedAt]
    )
  }

  async updateReferenceData(id: string, updates: Partial<ReferenceData>): Promise<void> {
    const r = this._queryOne('SELECT * FROM reference_data WHERE id = ?', [id])
    if (!r) return
    const existing = this._rowToReferenceData(r)
    const merged = { ...existing, ...updates }
    await this.insertReferenceData(merged)
  }

  async deleteReferenceData(id: string): Promise<void> {
    this._run('DELETE FROM reference_data WHERE id = ?', [id])
  }

  // ── StorageAdapter: Foreshadows ──

  async fetchForeshadows(projectId: string): Promise<Foreshadow[]> {
    return this._queryAll('SELECT * FROM foreshadows WHERE project_id = ?', [projectId])
      .map(r => this._rowToForeshadow(r))
  }

  async insertForeshadow(fs: Foreshadow): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO foreshadows (id, project_id, title, description, status, planted_chapter_id, resolved_chapter_id, importance, tags, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [fs.id, fs.projectId, fs.title, fs.description, fs.status,
       fs.plantedChapterId, fs.resolvedChapterId, fs.importance,
       JSON.stringify(fs.tags), fs.notes, fs.createdAt, fs.updatedAt]
    )
  }

  async updateForeshadow(id: string, updates: Partial<Foreshadow>): Promise<void> {
    const r = this._queryOne('SELECT * FROM foreshadows WHERE id = ?', [id])
    if (!r) return
    const existing = this._rowToForeshadow(r)
    const merged = { ...existing, ...updates }
    await this.insertForeshadow(merged)
  }

  async deleteForeshadow(id: string): Promise<void> {
    this._run('DELETE FROM foreshadows WHERE id = ?', [id])
  }

  // ── StorageAdapter: Entity Versions ──

  async fetchVersions(projectId: string, entityType?: string, entityId?: string): Promise<EntityVersion[]> {
    let sql = 'SELECT * FROM entity_versions WHERE project_id = ?'
    const params: any[] = [projectId]
    if (entityType) { sql += ' AND entity_type = ?'; params.push(entityType) }
    if (entityId) { sql += ' AND entity_id = ?'; params.push(entityId) }
    sql += ' ORDER BY version_number DESC'
    return this._queryAll(sql, params).map(r => this._rowToEntityVersion(r))
  }

  async insertVersion(version: EntityVersion): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO entity_versions (id, project_id, entity_type, entity_id, version_number, data, label, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [version.id, version.projectId, version.entityType, version.entityId,
       version.versionNumber, JSON.stringify(version.data), version.label,
       version.createdBy, version.createdAt]
    )
  }

  async deleteVersion(id: string): Promise<void> {
    this._run('DELETE FROM entity_versions WHERE id = ?', [id])
  }

  async deleteVersionsByEntity(entityType: string, entityId: string): Promise<void> {
    this._run('DELETE FROM entity_versions WHERE entity_type = ? AND entity_id = ?', [entityType, entityId])
  }

  async getMaxVersionNumber(entityType: string, entityId: string): Promise<number> {
    const r = this._queryOne<any>(
      'SELECT MAX(version_number) as max_ver FROM entity_versions WHERE entity_type = ? AND entity_id = ?',
      [entityType, entityId]
    )
    return r?.max_ver ?? 0
  }

  // ── StorageAdapter: AI Conversations ──

  async fetchConversations(projectId: string): Promise<AIConversation[]> {
    return this._queryAll('SELECT * FROM ai_conversations WHERE project_id = ? ORDER BY created_at DESC', [projectId])
      .map(r => this._rowToConversation(r))
  }

  async insertConversation(conv: AIConversation): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO ai_conversations (id, project_id, title, messages, created_at, used_providers)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [conv.id, conv.projectId, conv.title, JSON.stringify(conv.messages),
       conv.createdAt, JSON.stringify(conv.usedProviders || [])]
    )
  }

  async updateConversation(id: string, updates: Partial<AIConversation>): Promise<void> {
    const r = this._queryOne('SELECT * FROM ai_conversations WHERE id = ?', [id])
    if (!r) return
    const existing = this._rowToConversation(r)
    const merged = { ...existing, ...updates }
    await this.insertConversation(merged)
  }

  async deleteConversation(id: string): Promise<void> {
    this._run('DELETE FROM ai_messages WHERE conversation_id = ?', [id])
    this._run('DELETE FROM ai_conversations WHERE id = ?', [id])
  }

  async deleteConversationsByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM ai_messages WHERE conversation_id IN (SELECT id FROM ai_conversations WHERE project_id = ?)', [projectId])
    this._run('DELETE FROM ai_conversations WHERE project_id = ?', [projectId])
  }

  // ── StorageAdapter: AI Messages ──

  async fetchMessages(conversationId: string): Promise<AIMessage[]> {
    return this._queryAll('SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY timestamp', [conversationId])
      .map(r => this._rowToMessage(r))
  }

  async insertMessage(msg: AIMessage & { conversationId: string }): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO ai_messages (id, conversation_id, role, content, provider, tool_calls, tool_results, attachments, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [msg.id, msg.conversationId, msg.role, msg.content, msg.provider || null,
       msg.toolCalls ? JSON.stringify(msg.toolCalls) : null,
       msg.toolResults ? JSON.stringify(msg.toolResults) : null,
       msg.attachments ? JSON.stringify(msg.attachments) : null,
       msg.timestamp]
    )
  }

  // ── StorageAdapter: Onion Nodes ──

  async fetchOnionNodes(projectId: string): Promise<OnionNode[]> {
    return this._queryAll('SELECT * FROM onion_nodes WHERE project_id = ? ORDER BY "order"', [projectId])
      .map(r => this._rowToOnionNode(r))
  }

  async fetchOnionNodesByChapter(chapterId: string): Promise<OnionNode[]> {
    return this._queryAll('SELECT * FROM onion_nodes WHERE chapter_id = ? ORDER BY "order"', [chapterId])
      .map(r => this._rowToOnionNode(r))
  }

  async insertOnionNode(node: OnionNode): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO onion_nodes (id, project_id, chapter_id, parent_id, title, content, "order", created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [node.id, node.projectId, node.chapterId, node.parentId,
       node.title, node.content, node.order, node.createdAt, node.updatedAt]
    )
  }

  async updateOnionNode(id: string, updates: Partial<OnionNode>): Promise<void> {
    const rows = this._queryAll('SELECT * FROM onion_nodes WHERE id = ?', [id])
    if (rows.length === 0) return
    const existing = this._rowToOnionNode(rows[0])
    const merged = { ...existing, ...updates, updatedAt: Date.now() }
    await this.insertOnionNode(merged)
  }

  async deleteOnionNode(id: string): Promise<void> {
    // Also delete children recursively
    const children = this._queryAll('SELECT id FROM onion_nodes WHERE parent_id = ?', [id])
    for (const child of children) {
      await this.deleteOnionNode((child as { id: string }).id)
    }
    this._run('DELETE FROM onion_nodes WHERE id = ?', [id])
  }

  async deleteOnionNodesByChapter(chapterId: string): Promise<void> {
    this._run('DELETE FROM onion_nodes WHERE chapter_id = ?', [chapterId])
  }

  async deleteOnionNodesByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM onion_nodes WHERE project_id = ?', [projectId])
  }

  // ── Migration: Import from JSON data ──

  async importFromJSONData(data: any): Promise<void> {
    if (data.project) await this.insertProject(sanitizeRecord(data.project, ['title', 'description', 'synopsis']))
    if (data.chapters) for (const c of data.chapters) await this.insertChapter(sanitizeRecord(c, ['title', 'synopsis']))
    if (data.characters) for (const c of data.characters) await this.insertCharacter(sanitizeRecord(c, ['name', 'personality', 'abilities', 'appearance', 'background', 'motivation', 'speechPattern', 'notes']))
    if (data.relations) for (const r of data.relations) await this.insertRelation(sanitizeRecord(r, ['relationType', 'description']))
    if (data.worldSettings) for (const w of data.worldSettings) await this.insertWorldSetting(sanitizeRecord(w, ['title', 'content']))
    if (data.foreshadows) for (const f of data.foreshadows) await this.insertForeshadow(sanitizeRecord(f, ['title', 'description', 'notes']))
    if (data.items) for (const i of data.items) await this.insertItem(sanitizeRecord(i, ['name', 'effect', 'description', 'notes']))
    if (data.referenceData) for (const r of data.referenceData) await this.insertReferenceData(sanitizeRecord(r, ['title', 'content', 'notes']))
    if (data.entityVersions) for (const v of data.entityVersions) await this.insertVersion(v)
    if (data.aiConversations) for (const c of data.aiConversations) await this.insertConversation(c)
    if (data.aiMessages) for (const m of data.aiMessages) await this.insertMessage(m)
    if (data.onionNodes) for (const n of data.onionNodes) await this.insertOnionNode(sanitizeRecord(n, ['title', 'content']))
    await this._persist()
  }

  // ── Auto-backup: periodic snapshots ──

  private _autoBackupTimer: ReturnType<typeof setInterval> | null = null
  private _autoBackupIntervalMs = 5 * 60 * 1000 // 5 minutes

  /** Start periodic auto-backup. Call after init. */
  startAutoBackup(): void {
    this.stopAutoBackup()
    this._autoBackupTimer = setInterval(() => {
      this._createAutoBackup()
    }, this._autoBackupIntervalMs)
  }

  /** Stop auto-backup timer */
  stopAutoBackup(): void {
    if (this._autoBackupTimer) {
      clearInterval(this._autoBackupTimer)
      this._autoBackupTimer = null
    }
  }

  private async _createAutoBackup(): Promise<void> {
    if (!this.db) return
    try {
      const data = this.db.export()
      const key = `onion-autobackup-${new Date().toISOString().slice(0, 16)}`
      await saveDatabaseToIDB(data, key)
      // Keep only the 3 most recent auto-backups
      await this._pruneAutoBackups()
    } catch (err) {
      console.error('[SQLite] Auto-backup failed:', err)
    }
  }

  private async _pruneAutoBackups(): Promise<void> {
    try {
      const keys = await this._getAutoBackupKeys()
      if (keys.length > 3) {
        const toDelete = keys.slice(0, keys.length - 3)
        for (const key of toDelete) {
          await deleteFromIDB(key)
        }
      }
    } catch {
      // Ignore pruning errors
    }
  }

  // ── Onion Flow: Canvas Nodes ──

  async fetchCanvasNodes(projectId: string, parentCanvasId?: string | null): Promise<CanvasNode[]> {
    let sql = 'SELECT * FROM canvas_nodes WHERE project_id = ?'
    const params: any[] = [projectId]
    if (parentCanvasId !== undefined) {
      if (parentCanvasId === null) {
        sql += ' AND parent_canvas_id IS NULL'
      } else {
        sql += ' AND parent_canvas_id = ?'
        params.push(parentCanvasId)
      }
    }
    return this._queryAll(sql, params).map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      parentCanvasId: r.parent_canvas_id || null,
      type: r.type,
      position: { x: r.position_x, y: r.position_y },
      data: JSON.parse(r.data || '{}'),
      width: r.width || undefined,
      height: r.height || undefined,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  }

  async insertCanvasNode(node: CanvasNode): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO canvas_nodes (id, project_id, parent_canvas_id, type, position_x, position_y, data, width, height, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [node.id, node.projectId, node.parentCanvasId, node.type,
       node.position.x, node.position.y, JSON.stringify(node.data),
       node.width || null, node.height || null, node.createdAt, node.updatedAt]
    )
  }

  async updateCanvasNode(id: string, updates: Partial<CanvasNode>): Promise<void> {
    const r = this._queryOne('SELECT * FROM canvas_nodes WHERE id = ?', [id])
    if (!r) return
    const existing: any = r
    const merged = {
      id: existing.id,
      projectId: existing.project_id,
      parentCanvasId: existing.parent_canvas_id || null,
      type: existing.type,
      position: { x: existing.position_x, y: existing.position_y },
      data: JSON.parse(existing.data || '{}'),
      width: existing.width || undefined,
      height: existing.height || undefined,
      createdAt: existing.created_at,
      updatedAt: Date.now(),
      ...updates,
    }
    await this.insertCanvasNode(merged)
  }

  async deleteCanvasNode(id: string): Promise<void> {
    // Delete child canvas nodes and wires
    const children = this._queryAll('SELECT id FROM canvas_nodes WHERE parent_canvas_id = ?', [id])
    for (const child of children) {
      await this.deleteCanvasNode((child as { id: string }).id)
    }
    this._run('DELETE FROM canvas_wires WHERE source_node_id = ? OR target_node_id = ?', [id, id])
    this._run('DELETE FROM canvas_nodes WHERE id = ?', [id])
  }

  async deleteCanvasNodesByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM canvas_wires WHERE project_id = ?', [projectId])
    this._run('DELETE FROM canvas_nodes WHERE project_id = ?', [projectId])
  }

  // ── Onion Flow: Canvas Wires ──

  async fetchCanvasWires(projectId: string, parentCanvasId?: string | null): Promise<CanvasWire[]> {
    let sql = 'SELECT * FROM canvas_wires WHERE project_id = ?'
    const params: any[] = [projectId]
    if (parentCanvasId !== undefined) {
      if (parentCanvasId === null) {
        sql += ' AND parent_canvas_id IS NULL'
      } else {
        sql += ' AND parent_canvas_id = ?'
        params.push(parentCanvasId)
      }
    }
    return this._queryAll(sql, params).map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      parentCanvasId: r.parent_canvas_id || null,
      sourceNodeId: r.source_node_id,
      targetNodeId: r.target_node_id,
      sourceHandle: r.source_handle,
      targetHandle: r.target_handle,
    }))
  }

  async insertCanvasWire(wire: CanvasWire): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO canvas_wires (id, project_id, parent_canvas_id, source_node_id, target_node_id, source_handle, target_handle)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [wire.id, wire.projectId, wire.parentCanvasId, wire.sourceNodeId,
       wire.targetNodeId, wire.sourceHandle, wire.targetHandle]
    )
  }

  async deleteCanvasWire(id: string): Promise<void> {
    this._run('DELETE FROM canvas_wires WHERE id = ?', [id])
  }

  async deleteCanvasWiresByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM canvas_wires WHERE project_id = ?', [projectId])
  }

  // ── Onion Flow: Wiki Entries ──

  async fetchWikiEntries(projectId: string): Promise<WikiEntry[]> {
    return this._queryAll('SELECT * FROM wiki_entries WHERE project_id = ? ORDER BY "order"', [projectId])
      .map((r: any) => ({
        id: r.id,
        projectId: r.project_id,
        category: r.category,
        title: r.title,
        content: r.content,
        tags: this._parseJsonArray<string>(r.tags),
        linkedEntityId: r.linked_entity_id || undefined,
        linkedEntityType: r.linked_entity_type || undefined,
        order: r.order,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }))
  }

  async insertWikiEntry(entry: WikiEntry): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO wiki_entries (id, project_id, category, title, content, tags, linked_entity_id, linked_entity_type, "order", created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry.id, entry.projectId, entry.category, entry.title, entry.content,
       JSON.stringify(entry.tags), entry.linkedEntityId || null,
       entry.linkedEntityType || null, entry.order, entry.createdAt, entry.updatedAt]
    )
  }

  async updateWikiEntry(id: string, updates: Partial<WikiEntry>): Promise<void> {
    const rows = this._queryAll('SELECT * FROM wiki_entries WHERE id = ?', [id])
    if (rows.length === 0) return
    const r: any = rows[0]
    const existing: WikiEntry = {
      id: r.id, projectId: r.project_id, category: r.category,
      title: r.title, content: r.content,
      tags: this._parseJsonArray<string>(r.tags),
      linkedEntityId: r.linked_entity_id || undefined,
      linkedEntityType: r.linked_entity_type || undefined,
      order: r.order, createdAt: r.created_at, updatedAt: r.updated_at,
    }
    await this.insertWikiEntry({ ...existing, ...updates, updatedAt: Date.now() })
  }

  async deleteWikiEntry(id: string): Promise<void> {
    this._run('DELETE FROM wiki_entries WHERE id = ?', [id])
  }

  async deleteWikiEntriesByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM wiki_entries WHERE project_id = ?', [projectId])
  }

  // ── Onion Flow: Emotion Logs ──

  async fetchEmotionLogs(projectId: string, characterId?: string): Promise<EmotionLog[]> {
    let sql = 'SELECT * FROM emotion_logs WHERE project_id = ?'
    const params: any[] = [projectId]
    if (characterId) {
      sql += ' AND character_id = ?'
      params.push(characterId)
    }
    sql += ' ORDER BY timestamp'
    return this._queryAll(sql, params).map((r: any) => ({
      id: r.id,
      projectId: r.project_id,
      characterId: r.character_id,
      chapterId: r.chapter_id,
      emotion: r.emotion,
      intensity: r.intensity,
      timestamp: r.timestamp,
    }))
  }

  async insertEmotionLog(log: EmotionLog): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO emotion_logs (id, project_id, character_id, chapter_id, emotion, intensity, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [log.id, log.projectId, log.characterId, log.chapterId,
       log.emotion, log.intensity, log.timestamp]
    )
  }

  async deleteEmotionLogsByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM emotion_logs WHERE project_id = ?', [projectId])
  }

  // ── Onion Flow: Story Summaries ──

  async fetchStorySummaries(projectId: string): Promise<StorySummary[]> {
    return this._queryAll('SELECT * FROM story_summaries WHERE project_id = ? ORDER BY created_at', [projectId])
      .map((r: any) => ({
        id: r.id,
        projectId: r.project_id,
        chapterId: r.chapter_id,
        summary: r.summary,
        activeHooks: this._parseJsonArray<string>(r.active_hooks),
        createdAt: r.created_at,
      }))
  }

  async insertStorySummary(summary: StorySummary): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO story_summaries (id, project_id, chapter_id, summary, active_hooks, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [summary.id, summary.projectId, summary.chapterId, summary.summary,
       JSON.stringify(summary.activeHooks), summary.createdAt]
    )
  }

  async deleteStorySummariesByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM story_summaries WHERE project_id = ?', [projectId])
  }

  // ── Onion Flow: Daily Stats ──

  async fetchDailyStats(projectId: string): Promise<DailyStats[]> {
    return this._queryAll('SELECT * FROM daily_stats WHERE project_id = ? ORDER BY date', [projectId])
      .map((r: any) => ({
        date: r.date,
        projectId: r.project_id,
        wordsWritten: r.words_written,
        timeSpentMin: r.time_spent_min,
      }))
  }

  async upsertDailyStats(stats: DailyStats): Promise<void> {
    this._run(
      `INSERT INTO daily_stats (date, project_id, words_written, time_spent_min)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(date, project_id) DO UPDATE SET
         words_written = excluded.words_written,
         time_spent_min = excluded.time_spent_min`,
      [stats.date, stats.projectId, stats.wordsWritten, stats.timeSpentMin]
    )
  }

  // ── Onion Flow: Timeline Snapshots ──

  async fetchTimelineSnapshots(projectId: string): Promise<TimelineSnapshot[]> {
    return this._queryAll('SELECT * FROM timeline_snapshots WHERE project_id = ? ORDER BY created_at DESC', [projectId])
      .map((r: any) => ({
        id: r.id,
        projectId: r.project_id,
        label: r.label,
        canvasData: r.canvas_data,
        manuscriptData: r.manuscript_data,
        wikiData: r.wiki_data,
        worldData: r.world_data,
        createdAt: r.created_at,
      }))
  }

  async insertTimelineSnapshot(snapshot: TimelineSnapshot): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO timeline_snapshots (id, project_id, label, canvas_data, manuscript_data, wiki_data, world_data, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [snapshot.id, snapshot.projectId, snapshot.label, snapshot.canvasData,
       snapshot.manuscriptData, snapshot.wikiData, snapshot.worldData, snapshot.createdAt]
    )
  }

  async deleteTimelineSnapshot(id: string): Promise<void> {
    this._run('DELETE FROM timeline_snapshots WHERE id = ?', [id])
  }

  async deleteTimelineSnapshotsByProject(projectId: string): Promise<void> {
    this._run('DELETE FROM timeline_snapshots WHERE project_id = ?', [projectId])
  }

  private _getAutoBackupKeys(): Promise<string[]> {
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
}
