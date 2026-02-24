import type {
  Project, Chapter, Character, CharacterRelation,
  WorldSetting, Foreshadow, EntityVersion,
  AIConversation, AIMessage, Item, ReferenceData,
  OnionNode, CanvasNode, CanvasWire, WikiEntry,
  EmotionLog, StorySummary, DailyStats, TimelineSnapshot,
  TrashItem,
} from '@/types'
import { SQLiteStorageAdapter } from './sqliteStorageAdapter'

// ── Storage Adapter Interface ──

export interface StorageAdapter {
  init?(): Promise<void>

  // Projects
  fetchProjects(): Promise<Project[]>
  fetchProject(id: string): Promise<Project | null>
  insertProject(project: Project): Promise<void>
  updateProject(id: string, updates: Partial<Project>): Promise<void>
  deleteProject(id: string): Promise<void>

  // Chapters
  fetchChapters(projectId: string): Promise<Chapter[]>
  fetchChapter(id: string): Promise<Chapter | null>
  insertChapter(chapter: Chapter): Promise<void>
  updateChapter(id: string, updates: Partial<Chapter>): Promise<void>
  deleteChapter(id: string): Promise<void>
  deleteChaptersByProject(projectId: string): Promise<void>

  // Characters
  fetchCharacters(projectId: string): Promise<Character[]>
  insertCharacter(character: Character): Promise<void>
  updateCharacter(id: string, updates: Partial<Character>): Promise<void>
  deleteCharacter(id: string): Promise<void>

  // Relations
  fetchRelations(projectId: string): Promise<CharacterRelation[]>
  insertRelation(relation: CharacterRelation): Promise<void>
  updateRelation(id: string, updates: Partial<CharacterRelation>): Promise<void>
  deleteRelation(id: string): Promise<void>
  deleteRelationsByCharacter(characterId: string): Promise<void>

  // World Settings
  fetchWorldSettings(projectId: string): Promise<WorldSetting[]>
  insertWorldSetting(ws: WorldSetting): Promise<void>
  updateWorldSetting(id: string, updates: Partial<WorldSetting>): Promise<void>
  deleteWorldSetting(id: string): Promise<void>

  // Items
  fetchItems(projectId: string): Promise<Item[]>
  insertItem(item: Item): Promise<void>
  updateItem(id: string, updates: Partial<Item>): Promise<void>
  deleteItem(id: string): Promise<void>

  // Reference Data
  fetchReferenceData(projectId: string): Promise<ReferenceData[]>
  insertReferenceData(ref: ReferenceData): Promise<void>
  updateReferenceData(id: string, updates: Partial<ReferenceData>): Promise<void>
  deleteReferenceData(id: string): Promise<void>

  // Foreshadows
  fetchForeshadows(projectId: string): Promise<Foreshadow[]>
  insertForeshadow(fs: Foreshadow): Promise<void>
  updateForeshadow(id: string, updates: Partial<Foreshadow>): Promise<void>
  deleteForeshadow(id: string): Promise<void>
  clearForeshadowChapterRefs(chapterId: string): Promise<void>

  // Cleanup
  cleanOrphanedRelations(projectId: string): Promise<number>

  // Entity Versions
  fetchVersions(projectId: string, entityType?: string, entityId?: string): Promise<EntityVersion[]>
  insertVersion(version: EntityVersion): Promise<void>
  deleteVersion(id: string): Promise<void>
  deleteVersionsByProject(projectId: string): Promise<void>
  deleteVersionsByEntity(entityType: string, entityId: string): Promise<void>
  getMaxVersionNumber(entityType: string, entityId: string): Promise<number>

  // AI Conversations
  fetchConversations(projectId: string): Promise<AIConversation[]>
  insertConversation(conv: AIConversation): Promise<void>
  updateConversation(id: string, updates: Partial<AIConversation>): Promise<void>
  deleteConversation(id: string): Promise<void>
  deleteConversationsByProject(projectId: string): Promise<void>

  // AI Messages
  fetchMessages(conversationId: string): Promise<AIMessage[]>
  insertMessage(msg: AIMessage & { conversationId: string }): Promise<void>

  // Onion Nodes
  fetchOnionNodes(projectId: string): Promise<OnionNode[]>
  fetchOnionNodesByChapter(chapterId: string): Promise<OnionNode[]>
  insertOnionNode(node: OnionNode): Promise<void>
  updateOnionNode(id: string, updates: Partial<OnionNode>): Promise<void>
  deleteOnionNode(id: string): Promise<void>
  deleteOnionNodesByChapter(chapterId: string): Promise<void>
  deleteOnionNodesByProject(projectId: string): Promise<void>

  // ── Onion Flow: Canvas Nodes ──
  fetchCanvasNodes(projectId: string, parentCanvasId?: string | null): Promise<CanvasNode[]>
  insertCanvasNode(node: CanvasNode): Promise<void>
  updateCanvasNode(id: string, updates: Partial<CanvasNode>): Promise<void>
  deleteCanvasNode(id: string): Promise<void>
  deleteCanvasNodesByProject(projectId: string): Promise<void>

  // ── Onion Flow: Canvas Wires ──
  fetchCanvasWires(projectId: string, parentCanvasId?: string | null): Promise<CanvasWire[]>
  insertCanvasWire(wire: CanvasWire): Promise<void>
  deleteCanvasWire(id: string): Promise<void>
  deleteCanvasWiresByProject(projectId: string): Promise<void>

  // ── Onion Flow: Wiki Entries ──
  fetchWikiEntries(projectId: string): Promise<WikiEntry[]>
  insertWikiEntry(entry: WikiEntry): Promise<void>
  updateWikiEntry(id: string, updates: Partial<WikiEntry>): Promise<void>
  deleteWikiEntry(id: string): Promise<void>
  deleteWikiEntriesByProject(projectId: string): Promise<void>

  // ── Onion Flow: Emotion Logs ──
  fetchEmotionLogs(projectId: string, characterId?: string): Promise<EmotionLog[]>
  insertEmotionLog(log: EmotionLog): Promise<void>
  deleteEmotionLogsByProject(projectId: string): Promise<void>

  // ── Onion Flow: Story Summaries ──
  fetchStorySummaries(projectId: string): Promise<StorySummary[]>
  insertStorySummary(summary: StorySummary): Promise<void>
  deleteStorySummariesByProject(projectId: string): Promise<void>

  // ── Onion Flow: Daily Stats ──
  fetchDailyStats(projectId: string): Promise<DailyStats[]>
  upsertDailyStats(stats: DailyStats): Promise<void>

  // ── Onion Flow: Timeline Snapshots ──
  fetchTimelineSnapshots(projectId: string): Promise<TimelineSnapshot[]>
  insertTimelineSnapshot(snapshot: TimelineSnapshot): Promise<void>
  deleteTimelineSnapshot(id: string): Promise<void>
  deleteTimelineSnapshotsByProject(projectId: string): Promise<void>

  // ── Trash / Recycle Bin ──
  fetchTrashItems(projectId: string): Promise<TrashItem[]>
  insertTrashItem(item: TrashItem): Promise<void>
  deleteTrashItem(id: string): Promise<void>
  purgeExpiredTrash(): Promise<number>
  deleteTrashByProject(projectId: string): Promise<void>

  // Transaction support
  transaction<T>(fn: () => Promise<T>): Promise<T>
}

// ── Singleton SQLite Adapter ──

let currentAdapter: SQLiteStorageAdapter | null = null

export function getAdapter(): SQLiteStorageAdapter {
  if (!currentAdapter) {
    currentAdapter = new SQLiteStorageAdapter()
  }
  return currentAdapter
}

export function resetAdapter(): void {
  if (currentAdapter) {
    currentAdapter.reset()
    currentAdapter = null
  }
}

export function getSQLiteAdapter(): SQLiteStorageAdapter {
  return getAdapter()
}
