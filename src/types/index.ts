import type { JSONContent } from '@tiptap/react'

// ── Project & Chapter ──

export interface Project {
  id: string
  title: string
  description: string
  genre: string
  synopsis: string
  createdAt: number
  updatedAt: number
  settings: ProjectSettings
  folderPath?: string           // Local folder path (Electron)
  usesFolderStorage?: boolean   // Web: true when File System Access API dirHandle is set
}

export interface ProjectSettings {
  language: 'en' | 'ko'
  targetDailyWords: number
  readingSpeedCPM: number
}

export interface Chapter {
  id: string
  projectId: string
  title: string
  order: number
  parentId: string | null
  type: 'volume' | 'chapter'
  content: JSONContent | null
  synopsis: string
  wordCount: number
  createdAt: number
  updatedAt: number
  isExpanded?: boolean
}

export interface ChapterTreeItem extends Chapter {
  children: ChapterTreeItem[]
}

// ── Onion Node (Editor Layers) ──

export interface OnionNode {
  id: string
  projectId: string
  chapterId: string
  parentId: string | null
  title: string
  content: string
  order: number
  createdAt: number
  updatedAt: number
}

export interface OnionNodeTreeItem extends OnionNode {
  children: OnionNodeTreeItem[]
  depth: number
}

// ── Word Count ──

export interface WordCountStats {
  characters: number
  charactersNoSpaces: number
  words: number
  pages200: number
  pagesA4: number
  pagesNovel: number
  readingTimeMin: number
}

export interface DailyStats {
  date: string
  projectId: string
  wordsWritten: number
  timeSpentMin: number
}

// ── Canvas Node System ──

export type CanvasNodeType =
  | 'character' | 'event' | 'wiki'
  | 'memory' | 'motivation'
  | 'image_load' | 'document_load' | 'plot_context' | 'plot_genre' | 'plot_structure'
  | 'pov' | 'pacing' | 'style_transfer' | 'output_format'
  | 'storyteller' | 'summarizer' | 'switch' | 'smart_switch'
  | 'save_content' | 'preview_content'
  | 'what_if' | 'show_dont_tell' | 'tikitaka'
  | 'cliffhanger' | 'virtual_reader'
  | 'emotion_tracker' | 'foreshadow_detector' | 'conflict_defense'
  | 'group'
  // Special nodes
  | 'preview_changed'
  | (string & {})   // Allow custom node types from plugins

export type CanvasNodeCategory = 'context' | 'direction' | 'processing' | 'special' | 'detector' | 'structure' | 'output' | 'plot'

export interface CanvasNode {
  id: string
  projectId: string
  parentCanvasId: string | null
  type: CanvasNodeType
  position: { x: number; y: number }
  data: Record<string, any>
  width?: number
  height?: number
  createdAt: number
  updatedAt: number
}

export interface CanvasWire {
  id: string
  projectId: string
  parentCanvasId: string | null
  sourceNodeId: string
  targetNodeId: string
  sourceHandle: string
  targetHandle: string
}

// ── Characters ──

export type CharacterPosition = 'rival' | 'villain' | 'friend' | 'mentor' | 'sidekick' | 'love_interest' | 'family' | 'subordinate' | 'neutral' | 'custom'

export type CharacterArchetype =
  | 'protagonist' | 'antagonist' | 'helper' | 'mentor' | 'betrayer'
  | 'guardian' | 'trickster' | 'shapeshifter' | 'herald' | 'shadow'
  | 'threshold_guardian' | 'ally' | 'other'

export type CharacterStatus = 'alive' | 'dead' | 'missing' | 'unknown'

export interface Character {
  id: string
  projectId: string
  name: string
  aliases: string[]
  role: 'protagonist' | 'antagonist' | 'supporting' | 'minor'
  position: CharacterPosition
  // Base info
  age: string
  job: string
  affiliation: string
  logline: string
  archetype: CharacterArchetype
  signatureItem: string
  habits: string
  status: CharacterStatus
  currentLocation: string
  // Inner motivation
  desire: string
  deficiency: string
  fear: string
  secret: string
  values: string
  // Descriptions
  personality: string
  abilities: string
  appearance: string
  background: string
  motivation: string
  speechPattern: string
  imageUrl: string
  tags: string[]
  notes: string
  createdAt: number
  updatedAt: number
}

export interface CharacterRelation {
  id: string
  projectId: string
  sourceId: string
  targetId: string
  relationType: string
  description: string
  isBidirectional: boolean
}

// ── World Building ──

export type WorldSettingCategory = 'magic' | 'technology' | 'geography' | 'politics' | 'culture' | 'history' | 'religion' | 'economy' | 'language' | 'species' | 'society' | 'disease' | 'other'

export interface WorldSetting {
  id: string
  projectId: string
  category: WorldSettingCategory
  title: string
  content: string
  tags: string[]
  order: number
  createdAt: number
  updatedAt: number
}

// ── Items ──

export type ItemType = 'weapon' | 'armor' | 'consumable' | 'food' | 'accessory' | 'tool' | 'material' | 'other'
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'unique'

export interface Item {
  id: string
  projectId: string
  name: string
  itemType: ItemType
  rarity: ItemRarity
  effect: string
  description: string
  owner: string
  tags: string[]
  notes: string
  order: number
  createdAt: number
  updatedAt: number
}

// ── Reference Data ──

export type ReferenceCategory = 'reference' | 'style_sample' | 'series' | 'worldbase' | 'mood' | 'other'

export interface ReferenceAttachment {
  name: string
  data: string
  mimeType: string
}

export interface ReferenceData {
  id: string
  projectId: string
  category: ReferenceCategory
  title: string
  content: string
  sourceUrl: string
  attachments: ReferenceAttachment[]
  tags: string[]
  useAsContext: boolean
  notes: string
  order: number
  createdAt: number
  updatedAt: number
}

// ── Foreshadowing ──

export interface Foreshadow {
  id: string
  projectId: string
  title: string
  description: string
  status: 'planted' | 'hinted' | 'resolved' | 'abandoned'
  plantedChapterId: string | null
  resolvedChapterId: string | null
  importance: 'low' | 'medium' | 'high' | 'critical'
  tags: string[]
  notes: string
  createdAt: number
  updatedAt: number
}

// ── Wiki ──

export type WikiCategory = WorldSettingCategory
  | 'character' | 'character_memory' | 'character_motivation'
  | 'event' | 'story' | 'plot'
  | 'item' | 'custom'

export type WikiFilterCategory = WikiCategory
  | 'group_character' | 'group_narrative' | 'group_world' | 'group_other'
  | 'all'

export interface WikiEntry {
  id: string
  projectId: string
  category: WikiCategory
  title: string
  content: string
  tags: string[]
  linkedEntityId?: string
  linkedEntityType?: EntityType
  order: number
  createdAt: number
  updatedAt: number
}

// ── Emotion Tracking ──

export interface EmotionLog {
  id: string
  projectId: string
  characterId: string
  chapterId: string
  emotion: string
  intensity: number // -100 to 100
  timestamp: number
}

// ── Story Summary ──

export interface StorySummary {
  id: string
  projectId: string
  chapterId: string
  summary: string
  activeHooks: string[]
  createdAt: number
}

// ── AI Integration ──

export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'llama' | 'grok'

export interface AIConfig {
  provider: AIProvider
  apiKey: string
  model: string
  enabled: boolean
  baseUrl?: string
}

export interface AIToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface AIToolResult {
  toolCallId: string
  success: boolean
  result: string
}

export interface AIAttachment {
  type: 'image' | 'file'
  name: string
  data: string
  mimeType: string
}

export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  provider?: AIProvider
  toolCalls?: AIToolCall[]
  toolResults?: AIToolResult[]
  attachments?: AIAttachment[]
  conversationId?: string
  timestamp: number
}

export interface AIConversation {
  id: string
  projectId: string
  title: string
  messages: AIMessage[]
  createdAt: number
  usedProviders?: AIProvider[]
}

export interface PromptTemplate {
  id: string
  name: string
  prompt: string
  category: 'writing' | 'analysis' | 'worldbuilding' | 'character' | 'custom' | 'action'
}

// ── Version Management ──

export interface Snapshot {
  id: string
  projectId: string
  chapterId: string
  chapterTitle: string
  content: JSONContent | null
  wordCount: number
  label: string
  createdAt: number
  backupData?: {
    chapters: { id: string; title: string; synopsis: string; content: any; wordCount: number; parentId: string | null; type: 'volume' | 'chapter'; order: number }[]
    characters: Character[]
    worldSettings: WorldSetting[]
    relations: CharacterRelation[]
    foreshadows: Foreshadow[]
    items?: Item[]
    referenceData?: ReferenceData[]
    onionNodes?: OnionNode[]
  }
}

export interface TimelineSnapshot {
  id: string
  projectId: string
  label: string
  canvasData: string       // JSON: { nodes: CanvasNode[], wires: CanvasWire[] }
  manuscriptData: string   // JSON: Chapter[] (content included)
  wikiData: string         // JSON: WikiEntry[]
  worldData: string        // JSON: { characters, worldSettings, items, foreshadows, relations }
  createdAt: number
}

export type EntityType = 'chapter' | 'character' | 'world_setting' | 'item' | 'reference_data' | 'foreshadow' | 'outline' | 'relation'

export interface EntityVersion {
  id: string
  projectId: string
  entityType: EntityType
  entityId: string
  versionNumber: number
  data: Record<string, unknown>
  label: string
  createdBy: 'user' | 'ai'
  createdAt: number
}

// ── Debate / Discussion (from Onion Ring) ──

export type DiscussionMode = 'roundRobin' | 'freeDiscussion' | 'roleAssignment' | 'battle'
export type DebateStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped'

export interface RoleConfig {
  provider: AIProvider
  role: string
}

export interface ReferenceFile {
  id: string
  filename: string
  mimeType: string
  size: number
  dataUrl: string
}

export interface DiscussionConfig {
  mode: DiscussionMode
  topic: string
  maxRounds: number
  participants: AIProvider[]
  roles: RoleConfig[]
  judgeProvider?: AIProvider
  referenceText: string
  useReference: boolean
  referenceFiles: ReferenceFile[]
  pacing: { mode: 'auto' | 'manual'; autoDelaySeconds: number }
}

export interface DiscussionMessage {
  id: string
  provider: AIProvider | 'user'
  content: string
  round: number
  timestamp: number
  error?: string
  files?: ReferenceFile[]
  messageType?: 'normal' | 'judge-evaluation'
  roleName?: string
}

export interface DebateCallbacks {
  onMessage: (msg: DiscussionMessage) => void
  onStatusChange: (status: DebateStatus) => void
  onRoundChange: (round: number, turnIndex: number) => void
  onLoadingChange: (provider: AIProvider | null) => void
  onCountdownTick: (secondsRemaining: number) => void
  waitForNextTurn: () => Promise<void>
  getStatus: () => DebateStatus
  getMessages: () => DiscussionMessage[]
}

// ── UI Types ──

export type SidebarTab = 'projects' | 'chapters' | 'search' | 'onionMap'

// ── Trash / Recycle Bin ──

export type TrashEntityType = 'wiki_entry' | 'canvas_node' | 'character' | 'chapter'
  | 'world_setting' | 'item' | 'reference_data' | 'foreshadow'

export interface TrashItem {
  id: string
  projectId: string
  entityType: TrashEntityType
  entityId: string
  entityData: Record<string, any>
  relatedData?: Record<string, any>
  deletedAt: number
  expiresAt: number  // deletedAt + 30 days
}
