/**
 * Zod schemas for AI tool parameter validation.
 * Ported from onion_editor.
 */
import { z } from 'zod'
import {
  CHARACTER_ROLES,
  WORLD_SETTING_CATEGORIES,
  FORESHADOW_STATUSES,
  FORESHADOW_IMPORTANCES,
  ITEM_TYPES,
  ITEM_RARITIES,
  EMOTION_TYPES,
  EMOTION_SCORE_MIN,
  EMOTION_SCORE_MAX,
  VERSIONABLE_ENTITY_TYPES,
  WIKI_CATEGORIES,
} from './constants'

const safeString = z.string().transform(s => s.replace(/<[^>]*>/g, ''))
const optionalSafeString = safeString.optional()
const safeStringArray = z.array(safeString).optional()

export const saveOutlineSchema = z.object({
  chapterId: z.string().min(1, 'chapterId는 필수입니다'),
  synopsis: safeString,
  versionLabel: optionalSafeString,
})

export const updateCharacterSchema = z.object({
  characterId: z.string().optional(),
  name: safeString.pipe(z.string().min(1, '이름은 필수입니다')),
  role: z.enum(CHARACTER_ROLES).optional(),
  personality: optionalSafeString,
  abilities: optionalSafeString,
  appearance: optionalSafeString,
  background: optionalSafeString,
  motivation: optionalSafeString,
  speechPattern: optionalSafeString,
  age: optionalSafeString,
  job: optionalSafeString,
  affiliation: optionalSafeString,
  desire: optionalSafeString,
  fear: optionalSafeString,
  secret: optionalSafeString,
  tags: safeStringArray,
  notes: optionalSafeString,
})

export const saveWorldSettingSchema = z.object({
  settingId: z.string().optional(),
  category: z.string().min(1, '카테고리는 필수입니다'),  // Not enum — resolveCategory() handles alias mapping
  title: safeString.pipe(z.string().min(1, '제목은 필수입니다')),
  content: safeString,
  tags: safeStringArray,
})
// Note: category is intentionally z.string() instead of z.enum(WORLD_SETTING_CATEGORIES)
// because resolveCategory() in the handler maps aliases (e.g. '마법' → 'magic')

export const saveRelationSchema = z.object({
  relationId: z.string().optional(),
  sourceName: safeString.pipe(z.string().min(1)),
  targetName: safeString.pipe(z.string().min(1)),
  relationType: safeString.pipe(z.string().min(1)),
  description: optionalSafeString,
  isBidirectional: z.boolean().optional(),
})

export const saveForeshadowSchema = z.object({
  foreshadowId: z.string().optional(),
  title: safeString.pipe(z.string().min(1, '제목은 필수입니다')),
  description: optionalSafeString,
  status: z.enum(FORESHADOW_STATUSES).optional(),
  importance: z.enum(FORESHADOW_IMPORTANCES).optional(),
  plantedChapterId: z.string().optional(),
  resolvedChapterId: z.string().optional(),
  tags: safeStringArray,
  notes: optionalSafeString,
})

export const saveItemSchema = z.object({
  itemId: z.string().optional(),
  name: safeString.pipe(z.string().min(1, '이름은 필수입니다')),
  itemType: z.enum(ITEM_TYPES).optional(),
  rarity: z.enum(ITEM_RARITIES).optional(),
  effect: optionalSafeString,
  description: optionalSafeString,
  owner: optionalSafeString,
  tags: safeStringArray,
  notes: optionalSafeString,
})

export const deleteCharacterSchema = z.object({ characterId: z.string().min(1) })
export const deleteWorldSettingSchema = z.object({ settingId: z.string().min(1) })
export const deleteItemSchema = z.object({ itemId: z.string().min(1) })
export const deleteForeshadowSchema = z.object({ foreshadowId: z.string().min(1) })
export const deleteRelationSchema = z.object({ relationId: z.string().min(1) })

export const createVersionSnapshotSchema = z.object({
  entityType: z.enum(VERSIONABLE_ENTITY_TYPES),
  entityId: z.string().min(1),
  label: safeString.pipe(z.string().min(1)),
})

const dataTypes = ['characters', 'world_settings', 'items', 'outline', 'foreshadows', 'relations', 'chapter_content', 'wiki_entries'] as const

export const getCurrentStateSchema = z.object({
  dataType: z.enum(dataTypes),
  entityId: z.string().optional(),
})

export const writeChapterContentSchema = z.object({
  chapterId: z.string().min(1),
  content: z.string().min(1),
  versionLabel: optionalSafeString,
})

export const appendToChapterSchema = z.object({
  chapterId: z.string().min(1),
  content: z.string().min(1),
})

export const createChapterSchema = z.object({
  title: safeString.pipe(z.string().min(1)),
  content: z.string().optional(),
  synopsis: optionalSafeString,
  parentId: z.string().optional(),
})

export const createVolumeSchema = z.object({
  title: safeString.pipe(z.string().min(1)),
})

export const renameChapterSchema = z.object({
  chapterId: z.string().min(1),
  newTitle: safeString.pipe(z.string().min(1)),
})

const emotionScore = z.number().min(EMOTION_SCORE_MIN).max(EMOTION_SCORE_MAX).default(0)
const chapterEmotionSchema = z.object({
  chapterId: z.string().min(1),
  ...Object.fromEntries(EMOTION_TYPES.map(e => [e, emotionScore.optional()])),
})

export const analyzeCharacterEmotionsSchema = z.object({
  characterName: z.string().min(1),
  chapterEmotions: z.array(chapterEmotionSchema).min(1),
})

export const respondSchema = z.object({ message: z.string().default('') })

export const createWikiEntrySchema = z.object({
  category: z.enum(WIKI_CATEGORIES),
  title: safeString.pipe(z.string().min(1, '제목은 필수입니다')),
  content: optionalSafeString,
  tags: safeStringArray,
})

export const updateWikiEntrySchema = z.object({
  entryId: z.string().min(1, 'entryId는 필수입니다'),
  title: optionalSafeString,
  content: optionalSafeString,
  tags: safeStringArray,
  category: z.enum(WIKI_CATEGORIES).optional(),
})

export const deleteWikiEntrySchema = z.object({
  entryId: z.string().min(1, 'entryId는 필수입니다'),
})

const TOOL_SCHEMAS: Record<string, z.ZodType> = {
  save_outline: saveOutlineSchema,
  update_character: updateCharacterSchema,
  save_world_setting: saveWorldSettingSchema,
  save_relation: saveRelationSchema,
  save_foreshadow: saveForeshadowSchema,
  save_item: saveItemSchema,
  delete_character: deleteCharacterSchema,
  delete_world_setting: deleteWorldSettingSchema,
  delete_item: deleteItemSchema,
  delete_foreshadow: deleteForeshadowSchema,
  delete_relation: deleteRelationSchema,
  create_version_snapshot: createVersionSnapshotSchema,
  get_current_state: getCurrentStateSchema,
  write_chapter_content: writeChapterContentSchema,
  append_to_chapter: appendToChapterSchema,
  create_chapter: createChapterSchema,
  create_volume: createVolumeSchema,
  rename_chapter: renameChapterSchema,
  analyze_character_emotions: analyzeCharacterEmotionsSchema,
  create_wiki_entry: createWikiEntrySchema,
  update_wiki_entry: updateWikiEntrySchema,
  delete_wiki_entry: deleteWikiEntrySchema,
  respond: respondSchema,
}

export function validateToolParams(
  toolName: string,
  params: Record<string, any>,
): { success: true; data: Record<string, any> } | { success: false; error: string } {
  const schema = TOOL_SCHEMAS[toolName]
  if (!schema) return { success: true, data: params }

  const result = schema.safeParse(params)
  if (!result.success) {
    const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    return { success: false, error: `파라미터 검증 실패: ${issues}` }
  }
  return { success: true, data: result.data as Record<string, any> }
}
