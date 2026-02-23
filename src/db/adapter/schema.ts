/**
 * Database schema: table creation DDL and migrations.
 * Extracted from SQLiteStorageAdapter._createTables() and _runMigrations().
 */
import type { Database } from 'sql.js'
import { nowUTC } from '@/lib/dateUtils'

export function createTables(db: Database): void {
  db.run(`
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

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_relations_project ON character_relations(project_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_relations_source ON character_relations(source_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_relations_target ON character_relations(target_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_world_settings_project ON world_settings(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_items_project ON items(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_reference_data_project ON reference_data(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_foreshadows_project ON foreshadows(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_entity_versions_project ON entity_versions(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_ai_conversations_project ON ai_conversations(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_onion_nodes_project ON onion_nodes(project_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_onion_nodes_chapter ON onion_nodes(chapter_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_onion_nodes_parent ON onion_nodes(parent_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_canvas_nodes_project ON canvas_nodes(project_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_canvas_nodes_parent ON canvas_nodes(parent_canvas_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_canvas_wires_project ON canvas_wires(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_wiki_entries_project ON wiki_entries(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_emotion_logs_project ON emotion_logs(project_id)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_emotion_logs_character ON emotion_logs(character_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_story_summaries_project ON story_summaries(project_id)`)

  db.run(`
    CREATE TABLE IF NOT EXISTS daily_stats (
      date TEXT NOT NULL,
      project_id TEXT NOT NULL,
      words_written INTEGER NOT NULL DEFAULT 0,
      time_spent_min INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date, project_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    )
  `)
  db.run(`CREATE INDEX IF NOT EXISTS idx_daily_stats_project ON daily_stats(project_id)`)

  db.run(`
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
  db.run(`CREATE INDEX IF NOT EXISTS idx_timeline_snapshots_project ON timeline_snapshots(project_id)`)

  db.run(`PRAGMA foreign_keys=ON`)

  runMigrations(db)
}

function runMigrations(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT 0
    )
  `)

  // Read applied migrations
  const stmt = db.prepare('SELECT name FROM _migrations')
  const applied = new Set<string>()
  while (stmt.step()) {
    const row = stmt.getAsObject() as { name: string }
    applied.add(row.name)
  }
  stmt.free()

  const migrations: Array<{ name: string; sql: string[] }> = [
    {
      name: 'add_character_position',
      sql: [
        `ALTER TABLE characters ADD COLUMN position TEXT NOT NULL DEFAULT 'neutral'`,
      ],
    },
  ]

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue
    try {
      for (const sql of migration.sql) {
        db.run(sql)
      }
      const mStmt = db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)')
      mStmt.bind([migration.name, nowUTC()])
      mStmt.step()
      mStmt.free()
    } catch (err) {
      console.error(`[SQLite] Migration '${migration.name}' failed:`, err)
    }
  }
}
