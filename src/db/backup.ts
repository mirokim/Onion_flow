/**
 * Full project backup: export all data as JSON, import from JSON.
 */
import { getAdapter } from './storageAdapter'
import type { Project, Chapter, Character, CharacterRelation, WorldSetting, Foreshadow, Item, ReferenceData, EntityVersion, AIConversation, AIMessage, OnionNode } from '@/types'
import { z } from 'zod/v4'

// ── Zod schemas for backup validation ──

const ProjectSchema = z.object({
  id: z.string().min(1),
  title: z.string(),
  description: z.string().optional().default(''),
  genre: z.string().optional().default(''),
  synopsis: z.string().optional().default(''),
  settings: z.record(z.string(), z.unknown()).optional().default({}),
  createdAt: z.number(),
  updatedAt: z.number(),
}).passthrough()

const ChapterSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string(),
  order: z.number(),
  parentId: z.string().nullable().optional().default(null),
  type: z.enum(['volume', 'chapter']).optional().default('chapter'),
  content: z.unknown().nullable().optional().default(null),
  synopsis: z.string().optional().default(''),
  wordCount: z.number().optional().default(0),
  createdAt: z.number(),
  updatedAt: z.number(),
}).passthrough()

const CharacterSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string(),
}).passthrough()

const RelationSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
}).passthrough()

const WorldSettingSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  category: z.string(),
  title: z.string(),
}).passthrough()

const ForeshadowSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string(),
}).passthrough()

const ItemSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  name: z.string(),
}).passthrough()

const ReferenceDataSchema = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  title: z.string(),
}).passthrough()

const ProjectBackupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  project: ProjectSchema,
  chapters: z.array(ChapterSchema),
  characters: z.array(CharacterSchema),
  relations: z.array(RelationSchema),
  worldSettings: z.array(WorldSettingSchema),
  foreshadows: z.array(ForeshadowSchema),
  items: z.array(ItemSchema).optional(),
  referenceData: z.array(ReferenceDataSchema).optional(),
  excalidrawData: z.unknown().optional(),
  entityVersions: z.array(z.record(z.string(), z.unknown())).optional(),
  aiConversations: z.array(z.record(z.string(), z.unknown())).optional(),
  aiMessages: z.array(z.record(z.string(), z.unknown())).optional(),
  onionNodes: z.array(z.record(z.string(), z.unknown())).optional(),
}).passthrough()

export { ProjectBackupSchema }

export interface ProjectBackup {
  version: 1
  exportedAt: number
  project: Project
  chapters: Chapter[]
  characters: Character[]
  relations: CharacterRelation[]
  worldSettings: WorldSetting[]
  foreshadows: Foreshadow[]
  items?: Item[]
  referenceData?: ReferenceData[]
  excalidrawData?: unknown
  entityVersions?: Record<string, unknown>[]
  aiConversations?: Record<string, unknown>[]
  aiMessages?: Record<string, unknown>[]
  onionNodes?: Record<string, unknown>[]
}

export interface FullBackup {
  version: 1
  exportedAt: number
  projects: ProjectBackup[]
}

// ── Export single project ──

export async function exportProject(projectId: string): Promise<ProjectBackup | null> {
  const adapter = getAdapter()
  const project = await adapter.fetchProject(projectId)
  if (!project) return null

  const chapters = await adapter.fetchChapters(projectId)
  const characters = await adapter.fetchCharacters(projectId)
  const relations = await adapter.fetchRelations(projectId)
  const worldSettings = await adapter.fetchWorldSettings(projectId)
  const foreshadows = await adapter.fetchForeshadows(projectId)
  const items = await adapter.fetchItems(projectId)
  const referenceData = await adapter.fetchReferenceData(projectId)
  const entityVersions = await adapter.fetchVersions(projectId)
  const onionNodes = await adapter.fetchOnionNodes(projectId)
  const aiConversations = await adapter.fetchConversations(projectId)

  // Collect AI messages for all conversations
  const aiMessages: Record<string, unknown>[] = []
  for (const conv of aiConversations) {
    const msgs = await adapter.fetchMessages(conv.id)
    aiMessages.push(...(msgs as unknown as Record<string, unknown>[]))
  }

  // Excalidraw map data from localStorage
  const excalidrawKey = `onion-excalidraw-${projectId}`
  const excalidrawRaw = localStorage.getItem(excalidrawKey)
  const excalidrawData = excalidrawRaw ? JSON.parse(excalidrawRaw) : undefined

  return {
    version: 1,
    exportedAt: Date.now(),
    project,
    chapters,
    characters,
    relations,
    worldSettings,
    foreshadows,
    items: items.length > 0 ? items : undefined,
    referenceData: referenceData.length > 0 ? referenceData : undefined,
    excalidrawData,
    entityVersions: entityVersions.length > 0 ? (entityVersions as unknown as Record<string, unknown>[]) : undefined,
    aiConversations: aiConversations.length > 0 ? (aiConversations as unknown as Record<string, unknown>[]) : undefined,
    aiMessages: aiMessages.length > 0 ? aiMessages : undefined,
    onionNodes: onionNodes.length > 0 ? (onionNodes as unknown as Record<string, unknown>[]) : undefined,
  }
}

// ── Export all projects ──

export async function exportAllProjects(): Promise<FullBackup> {
  const projects = await getAdapter().fetchProjects()
  const backups: ProjectBackup[] = []
  for (const p of projects) {
    const backup = await exportProject(p.id)
    if (backup) backups.push(backup)
  }
  return {
    version: 1,
    exportedAt: Date.now(),
    projects: backups,
  }
}

// ── Security: Sanitize text fields to strip dangerous HTML/script tags ──
// Covers: direct tags, HTML entity-encoded tags, CSS/SVG injection vectors
const DANGEROUS_TAGS = /<\s*\/?\s*(script|iframe|object|embed|form|input|link|meta|style|base|svg|math|template|slot)\b[^>]*>/gi
const DANGEROUS_ATTRS = /\s(on\w+|srcdoc|formaction|xlink:href|data-bind)\s*=/gi
const HTML_ENTITY_SCRIPT = /&(#60|lt);?\s*\/?\s*(script|iframe|object|embed|svg)\b/gi
const JAVASCRIPT_URLS = /(javascript|vbscript|data)\s*:/gi

export function sanitizeTextField(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '')
  return value
    .replace(DANGEROUS_TAGS, '')
    .replace(DANGEROUS_ATTRS, ' data-removed=')
    .replace(HTML_ENTITY_SCRIPT, '')
    .replace(JAVASCRIPT_URLS, 'blocked:')
}

export function sanitizeRecord<T extends Record<string, any>>(record: T, textFields: string[]): T {
  const sanitized = { ...record }
  for (const field of textFields) {
    if (field in sanitized && typeof sanitized[field] === 'string') {
      ;(sanitized as Record<string, unknown>)[field] = sanitizeTextField(sanitized[field])
    }
  }
  return sanitized
}

// ── Validation: Check required fields for backup data integrity ──

function validateProjectBackup(backup: unknown): backup is ProjectBackup {
  const result = ProjectBackupSchema.safeParse(backup)
  if (!result.success) {
    console.warn('[Backup] Validation failed:', result.error.issues.map(i => i.message).join(', '))
  }
  return result.success
}

// ── Import single project ──

export async function importProjectBackup(backup: ProjectBackup): Promise<void> {
  if (!validateProjectBackup(backup)) {
    throw new Error('Invalid backup data: missing required fields (project, chapters, characters, etc.)')
  }

  const adapter = getAdapter()

  // Sanitize text fields to prevent XSS via imported data
  const project = sanitizeRecord(backup.project, ['title', 'description', 'synopsis'])

  // Upsert project
  const existing = await adapter.fetchProject(project.id)
  if (existing) {
    await adapter.updateProject(project.id, project)
  } else {
    await adapter.insertProject(project)
  }

  // Clear all existing project data before re-importing to prevent orphan records
  const projectId = project.id
  await adapter.deleteChaptersByProject(projectId)
  await adapter.deleteCharactersByProject(projectId)
  await adapter.deleteRelationsByProject(projectId)
  await adapter.deleteWorldSettingsByProject(projectId)
  await adapter.deleteForeshadowsByProject(projectId)
  await adapter.deleteItemsByProject(projectId)
  await adapter.deleteReferenceDataByProject(projectId)
  await adapter.deleteVersionsByProject(projectId)
  await adapter.deleteConversationsByProject(projectId)
  await adapter.deleteOnionNodesByProject(projectId)

  for (const ch of backup.chapters) {
    const sanitized = sanitizeRecord(ch, ['title', 'synopsis'])
    await adapter.insertChapter(sanitized)
  }

  for (const c of backup.characters) {
    await adapter.insertCharacter(sanitizeRecord(c, ['name', 'personality', 'abilities', 'appearance', 'background', 'motivation', 'speechPattern', 'notes']))
  }
  for (const r of backup.relations) {
    await adapter.insertRelation(sanitizeRecord(r, ['relationType', 'description']))
  }
  for (const ws of backup.worldSettings) {
    await adapter.insertWorldSetting(sanitizeRecord(ws, ['title', 'content']))
  }
  for (const fs of backup.foreshadows) {
    await adapter.insertForeshadow(sanitizeRecord(fs, ['title', 'description', 'notes']))
  }
  if (backup.items) {
    for (const item of backup.items) {
      await adapter.insertItem(sanitizeRecord(item, ['name', 'effect', 'description', 'notes']))
    }
  }
  if (backup.referenceData) {
    for (const rd of backup.referenceData) {
      await adapter.insertReferenceData(sanitizeRecord(rd, ['title', 'content', 'notes']))
    }
  }

  // Restore excalidraw data
  if (backup.excalidrawData) {
    localStorage.setItem(`onion-excalidraw-${backup.project.id}`, JSON.stringify(backup.excalidrawData))
  }

  // Restore entity versions
  if (backup.entityVersions) {
    for (const v of backup.entityVersions) {
      await adapter.insertVersion(v as unknown as EntityVersion)
    }
  }

  // Restore AI conversations
  if (backup.aiConversations) {
    for (const c of backup.aiConversations) {
      await adapter.insertConversation(c as unknown as AIConversation)
    }
  }

  // Restore AI messages
  if (backup.aiMessages) {
    for (const m of backup.aiMessages) {
      await adapter.insertMessage(m as unknown as AIMessage & { conversationId: string })
    }
  }

  // Restore onion nodes
  if (backup.onionNodes) {
    for (const n of backup.onionNodes) {
      await adapter.insertOnionNode(sanitizeRecord(n, ['title', 'content']) as unknown as OnionNode)
    }
  }
}

// ── Import full backup ──

export async function importFullBackup(backup: FullBackup): Promise<number> {
  if (!backup || !Array.isArray(backup.projects)) {
    throw new Error('Invalid full backup: missing projects array')
  }
  let count = 0
  for (const pb of backup.projects) {
    await importProjectBackup(pb)
    count++
  }
  return count
}

// ── Download as JSON file ──

export function downloadJSON(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── Read JSON file from input ──

export function readJSONFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string))
      } catch {
        reject(new Error('Invalid JSON file'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
