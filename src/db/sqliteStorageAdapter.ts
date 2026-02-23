/**
 * SQLite-based StorageAdapter using sql.js (WASM).
 * Persists the database to IndexedDB automatically — no user permission required.
 *
 * Heavy logic has been extracted to domain modules under ./adapter/:
 *   - schema.ts: DDL & migrations
 *   - rowMappers.ts: DB row → TypeScript type conversions
 *   - persistence.ts: IndexedDB load/save helpers
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
  EntityVersion, AIConversation, AIMessage, OnionNode,
  CanvasNode, CanvasWire, WikiEntry, EmotionLog, StorySummary, DailyStats, TimelineSnapshot,
} from '@/types'
import type { StorageAdapter } from './storageAdapter'
import { sanitizeRecord } from './backup'
import { nowUTC } from '@/lib/dateUtils'

// ── Extracted modules ──
import { createTables } from './adapter/schema'
import {
  ts, parseJsonArray,
  rowToProject, rowToChapter, rowToCharacter, rowToRelation,
  rowToWorldSetting, rowToItem, rowToReferenceData, rowToForeshadow,
  rowToEntityVersion, rowToConversation, rowToMessage, rowToOnionNode,
} from './adapter/rowMappers'
import {
  loadDatabaseFromIDB, saveDatabaseToIDB, deleteFromIDB, getAutoBackupKeys,
} from './adapter/persistence'

// ── SQLiteStorageAdapter ──

export class SQLiteStorageAdapter implements StorageAdapter {
  private db: Database | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null
  private dirty = false
  // IndexedDB is now a backup-only store; primary persistence is folder-based (3 files).
  // Reduced from 500ms to 10s since IndexedDB writes are supplementary snapshots.
  private DEBOUNCE_MS = 10_000
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

  /** Initialize: always start fresh — folder-based projects are reloaded on demand */
  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    const SQL = await loadSqlJs()

    // Clear stale IndexedDB data — folder-based projects will be reloaded via "폴더 열기"
    await deleteFromIDB('onion-main-db')
    const backupKeys = await getAutoBackupKeys()
    for (const key of backupKeys) {
      await deleteFromIDB(key)
    }
    console.log('[SQLite] Cleared IndexedDB — starting fresh')

    this.db = new SQL.Database()
    createTables(this.db)
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

    createTables(this.db)
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

    createTables(this.db)
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

    createTables(this.db)
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

    createTables(this.db)
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
      createTables(this.db) // Ensure any missing tables are added
      await this._persist()
      return true
    } catch (err) {
      console.error('[SQLite] Failed to import database file:', err)
      return false
    }
  }

  // ── Query helpers ──

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

  // ── StorageAdapter: Projects ──

  async fetchProjects(): Promise<Project[]> {
    return this._queryAll('SELECT * FROM projects ORDER BY updated_at DESC').map(r => rowToProject(r))
  }

  async fetchProject(id: string): Promise<Project | null> {
    const r = this._queryOne('SELECT * FROM projects WHERE id = ?', [id])
    return r ? rowToProject(r) : null
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
      .map(r => rowToChapter(r))
  }

  async fetchChapter(id: string): Promise<Chapter | null> {
    const r = this._queryOne('SELECT * FROM chapters WHERE id = ?', [id])
    return r ? rowToChapter(r) : null
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
      .map(r => rowToCharacter(r))
  }

  async insertCharacter(character: Character): Promise<void> {
    this._run(
      `INSERT OR REPLACE INTO characters (id, project_id, name, aliases, role, position, personality, abilities, appearance, background, motivation, speech_pattern, image_url, tags, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [character.id, character.projectId, character.name, JSON.stringify(character.aliases),
       character.role, character.position || 'neutral', character.personality, character.abilities, character.appearance,
       character.background, character.motivation, character.speechPattern, character.imageUrl,
       JSON.stringify(character.tags), character.notes, character.createdAt, character.updatedAt]
    )
  }

  async updateCharacter(id: string, updates: Partial<Character>): Promise<void> {
    const existing = await this._fetchCharacter(id)
    if (!existing) return
    const merged = { ...existing, ...updates }
    await this.insertCharacter(merged)
  }

  async deleteCharacter(id: string): Promise<void> {
    this._run('DELETE FROM characters WHERE id = ?', [id])
  }

  private async _fetchCharacter(id: string): Promise<Character | null> {
    const r = this._queryOne('SELECT * FROM characters WHERE id = ?', [id])
    return r ? rowToCharacter(r) : null
  }

  // ── StorageAdapter: Relations ──

  async fetchRelations(projectId: string): Promise<CharacterRelation[]> {
    return this._queryAll('SELECT * FROM character_relations WHERE project_id = ?', [projectId])
      .map(r => rowToRelation(r))
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
    const existing = rowToRelation(r)
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
      .map(r => rowToWorldSetting(r))
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
    const existing = rowToWorldSetting(r)
    const merged = { ...existing, ...updates }
    await this.insertWorldSetting(merged)
  }

  async deleteWorldSetting(id: string): Promise<void> {
    this._run('DELETE FROM world_settings WHERE id = ?', [id])
  }

  // ── StorageAdapter: Items ──

  async fetchItems(projectId: string): Promise<Item[]> {
    return this._queryAll('SELECT * FROM items WHERE project_id = ? ORDER BY "order"', [projectId])
      .map(r => rowToItem(r))
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
    const existing = rowToItem(r)
    const merged = { ...existing, ...updates }
    await this.insertItem(merged)
  }

  async deleteItem(id: string): Promise<void> {
    this._run('DELETE FROM items WHERE id = ?', [id])
  }

  // ── StorageAdapter: Reference Data ──

  async fetchReferenceData(projectId: string): Promise<ReferenceData[]> {
    return this._queryAll('SELECT * FROM reference_data WHERE project_id = ? ORDER BY "order"', [projectId])
      .map(r => rowToReferenceData(r))
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
    const existing = rowToReferenceData(r)
    const merged = { ...existing, ...updates }
    await this.insertReferenceData(merged)
  }

  async deleteReferenceData(id: string): Promise<void> {
    this._run('DELETE FROM reference_data WHERE id = ?', [id])
  }

  // ── StorageAdapter: Foreshadows ──

  async fetchForeshadows(projectId: string): Promise<Foreshadow[]> {
    return this._queryAll('SELECT * FROM foreshadows WHERE project_id = ?', [projectId])
      .map(r => rowToForeshadow(r))
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
    const existing = rowToForeshadow(r)
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
    return this._queryAll(sql, params).map(r => rowToEntityVersion(r))
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
      .map(r => rowToConversation(r))
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
    const existing = rowToConversation(r)
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
      .map(r => rowToMessage(r))
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
      .map(r => rowToOnionNode(r))
  }

  async fetchOnionNodesByChapter(chapterId: string): Promise<OnionNode[]> {
    return this._queryAll('SELECT * FROM onion_nodes WHERE chapter_id = ? ORDER BY "order"', [chapterId])
      .map(r => rowToOnionNode(r))
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
    const existing = rowToOnionNode(rows[0])
    const merged = { ...existing, ...updates, updatedAt: nowUTC() }
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
      const keys = await getAutoBackupKeys()
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
      ...ts(r),
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
      updatedAt: nowUTC(),
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
        tags: parseJsonArray<string>(r.tags),
        linkedEntityId: r.linked_entity_id || undefined,
        linkedEntityType: r.linked_entity_type || undefined,
        order: r.order,
        ...ts(r),
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
      tags: parseJsonArray<string>(r.tags),
      linkedEntityId: r.linked_entity_id || undefined,
      linkedEntityType: r.linked_entity_type || undefined,
      order: r.order, ...ts(r),
    }
    await this.insertWikiEntry({ ...existing, ...updates, updatedAt: nowUTC() })
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
        activeHooks: parseJsonArray<string>(r.active_hooks),
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
}
