/**
 * Row mapper functions: convert raw SQL.js row objects to typed TypeScript entities.
 * Extracted from SQLiteStorageAdapter._rowTo* methods.
 */
import type {
  Project, Chapter, Character, CharacterRelation,
  WorldSetting, Foreshadow, Item, ReferenceData,
  EntityVersion, AIConversation, AIMessage, AIProvider, OnionNode,
} from '@/types'

/** Extract common timestamp fields from a DB row */
export function ts(r: any): { createdAt: number; updatedAt: number } {
  return { createdAt: r.created_at, updatedAt: r.updated_at }
}

/** Safely parse a JSON-encoded array column, always returning an array */
export function parseJsonArray<T = any>(raw: unknown, fallback: T[] = []): T[] {
  if (Array.isArray(raw)) return raw
  if (typeof raw !== 'string' || !raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : fallback
  } catch {
    return raw.split(',').map(s => s.trim()).filter(Boolean) as unknown as T[]
  }
}

export function rowToProject(r: any): Project {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    genre: r.genre,
    synopsis: r.synopsis,
    settings: JSON.parse(r.settings || '{}'),
    ...ts(r),
  }
}

export function rowToChapter(r: any): Chapter {
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
    ...ts(r),
  }
}

export function rowToCharacter(r: any): Character {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    aliases: parseJsonArray<string>(r.aliases),
    role: r.role,
    position: r.position || 'neutral',
    personality: r.personality,
    abilities: r.abilities,
    appearance: r.appearance,
    background: r.background,
    motivation: r.motivation,
    speechPattern: r.speech_pattern,
    imageUrl: r.image_url,
    tags: parseJsonArray<string>(r.tags),
    notes: r.notes,
    ...ts(r),
  }
}

export function rowToRelation(r: any): CharacterRelation {
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

export function rowToWorldSetting(r: any): WorldSetting {
  return {
    id: r.id,
    projectId: r.project_id,
    category: r.category,
    title: r.title,
    content: r.content,
    tags: parseJsonArray<string>(r.tags),
    order: r.order,
    ...ts(r),
  }
}

export function rowToItem(r: any): Item {
  return {
    id: r.id,
    projectId: r.project_id,
    name: r.name,
    itemType: r.item_type,
    rarity: r.rarity,
    effect: r.effect,
    description: r.description,
    owner: r.owner,
    tags: parseJsonArray<string>(r.tags),
    notes: r.notes,
    order: r.order,
    ...ts(r),
  }
}

export function rowToReferenceData(r: any): ReferenceData {
  return {
    id: r.id,
    projectId: r.project_id,
    category: r.category,
    title: r.title,
    content: r.content,
    sourceUrl: r.source_url,
    attachments: parseJsonArray(r.attachments),
    tags: parseJsonArray<string>(r.tags),
    useAsContext: !!r.use_as_context,
    notes: r.notes,
    order: r.order,
    ...ts(r),
  }
}

export function rowToForeshadow(r: any): Foreshadow {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    description: r.description,
    status: r.status,
    plantedChapterId: r.planted_chapter_id || null,
    resolvedChapterId: r.resolved_chapter_id || null,
    importance: r.importance,
    tags: parseJsonArray<string>(r.tags),
    notes: r.notes,
    ...ts(r),
  }
}

export function rowToEntityVersion(r: any): EntityVersion {
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

export function rowToConversation(r: any): AIConversation {
  return {
    id: r.id,
    projectId: r.project_id,
    title: r.title,
    messages: parseJsonArray(r.messages),
    createdAt: r.created_at,
    usedProviders: parseJsonArray<AIProvider>(r.used_providers),
  }
}

export function rowToMessage(r: any): AIMessage & { conversationId: string } {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    role: r.role,
    content: r.content,
    provider: r.provider || undefined,
    toolCalls: r.tool_calls ? parseJsonArray(r.tool_calls) : undefined,
    toolResults: r.tool_results ? parseJsonArray(r.tool_results) : undefined,
    attachments: r.attachments ? parseJsonArray(r.attachments) : undefined,
    timestamp: r.timestamp,
  }
}

export function rowToOnionNode(r: any): OnionNode {
  return {
    id: r.id,
    projectId: r.project_id,
    chapterId: r.chapter_id,
    parentId: r.parent_id || null,
    title: r.title,
    content: r.content,
    order: r.order,
    ...ts(r),
  }
}
