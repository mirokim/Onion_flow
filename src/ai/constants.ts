/**
 * Centralized constants for the AI module.
 * Single source of truth for enums, magic numbers, category aliases, and messages.
 */

// ── Character Roles ──
export const CHARACTER_ROLES = ['protagonist', 'antagonist', 'supporting', 'minor'] as const
export type CharacterRole = typeof CHARACTER_ROLES[number]

// ── World Setting Categories ──
export const WORLD_SETTING_CATEGORIES = [
  'magic', 'technology', 'geography', 'politics', 'culture', 'history',
  'religion', 'economy', 'language', 'species', 'society', 'disease', 'other',
] as const
export type WorldSettingCategoryValue = typeof WORLD_SETTING_CATEGORIES[number]

export const CATEGORY_ALIAS_MAP: Record<string, WorldSettingCategoryValue> = {
  '마법': 'magic', 'magic_system': 'magic', 'sorcery': 'magic', 'spell': 'magic',
  'mana': 'magic', 'arcane': 'magic', 'supernatural': 'magic',
  '기술': 'technology', 'tech': 'technology', 'science': 'technology',
  '지리': 'geography', 'terrain': 'geography', 'map': 'geography', 'location': 'geography',
  '정치': 'politics', 'government': 'politics', 'kingdom': 'politics',
  '문화': 'culture', 'tradition': 'culture', 'customs': 'culture',
  '역사': 'history', 'lore': 'history', 'legend': 'history',
  '종교': 'religion', 'faith': 'religion', 'deity': 'religion',
  '경제': 'economy', 'trade': 'economy', 'commerce': 'economy',
  '언어': 'language', 'dialect': 'language', 'script': 'language',
  '종족': 'species', 'race': 'species', 'creature': 'species',
  '사회': 'society', 'social': 'society', 'class': 'society',
  '질병': 'disease', 'illness': 'disease', 'plague': 'disease',
  '기타': 'other', 'misc': 'other', 'general': 'other',
}

export function resolveCategory(category: string): WorldSettingCategoryValue {
  if ((WORLD_SETTING_CATEGORIES as readonly string[]).includes(category)) {
    return category as WorldSettingCategoryValue
  }
  return CATEGORY_ALIAS_MAP[category.toLowerCase().trim()] || 'other'
}

// ── Foreshadow Constants ──
export const FORESHADOW_STATUSES = ['planted', 'hinted', 'resolved', 'abandoned'] as const
export const FORESHADOW_IMPORTANCES = ['low', 'medium', 'high', 'critical'] as const

// ── Item Constants ──
export const ITEM_TYPES = ['weapon', 'armor', 'consumable', 'food', 'accessory', 'tool', 'material', 'other'] as const
export const ITEM_RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'unique'] as const

// ── Emotion Constants ──
export const EMOTION_TYPES = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'love', 'tension', 'determination'] as const
export type EmotionType = typeof EMOTION_TYPES[number]
export const EMOTION_SCORE_MIN = 0
export const EMOTION_SCORE_MAX = 10

// ── Entity Version Types ──
export const VERSIONABLE_ENTITY_TYPES = ['chapter', 'character', 'world_setting', 'foreshadow', 'outline', 'relation'] as const

// ── Truncation Limits ──
export const PROMPT_LIMITS = {
  WORLD_SETTING_CONTENT_PREVIEW: 80,
  REFERENCE_DATA_PREVIEW: 300,
  MAX_WORLD_SETTINGS: 15,
  MAX_ITEMS: 15,
  MAX_FORESHADOWS: 10,
  CURRENT_CHAPTER_PREVIEW: 1000,
  COMPACT_CONTENT_PREVIEW: 40,
  COMPACT_PERSONALITY_PREVIEW: 25,
  COMPACT_CHAPTER_PREVIEW: 500,
  COMPACT_MAX_CHARACTERS: 3,
  COMPACT_MAX_WORLD_SETTINGS: 2,
  COMPACT_MAX_ITEMS: 2,
  COMPACT_MAX_FORESHADOWS: 2,
} as const

// ── AI Access Scope ──
export type AIAccessLevel = 'full' | 'read_only' | 'none'

export interface AIAccessScope {
  characters: AIAccessLevel
  worldSettings: AIAccessLevel
  items: AIAccessLevel
  foreshadows: AIAccessLevel
  chapters: AIAccessLevel
  referenceData: AIAccessLevel
  relations: AIAccessLevel
  emotions: AIAccessLevel
}

export const DEFAULT_AI_ACCESS_SCOPE: AIAccessScope = {
  characters: 'full',
  worldSettings: 'full',
  items: 'full',
  foreshadows: 'full',
  chapters: 'full',
  referenceData: 'read_only',
  relations: 'full',
  emotions: 'full',
}

export const TOOL_ACCESS_REQUIREMENTS: Record<string, { scope: keyof AIAccessScope; level: AIAccessLevel }> = {
  get_current_state: { scope: 'characters', level: 'read_only' },
  update_character: { scope: 'characters', level: 'full' },
  delete_character: { scope: 'characters', level: 'full' },
  save_world_setting: { scope: 'worldSettings', level: 'full' },
  delete_world_setting: { scope: 'worldSettings', level: 'full' },
  save_item: { scope: 'items', level: 'full' },
  delete_item: { scope: 'items', level: 'full' },
  save_foreshadow: { scope: 'foreshadows', level: 'full' },
  delete_foreshadow: { scope: 'foreshadows', level: 'full' },
  save_relation: { scope: 'relations', level: 'full' },
  write_chapter_content: { scope: 'chapters', level: 'full' },
  append_to_chapter: { scope: 'chapters', level: 'full' },
  create_chapter: { scope: 'chapters', level: 'full' },
  create_volume: { scope: 'chapters', level: 'full' },
  rename_chapter: { scope: 'chapters', level: 'full' },
  save_outline: { scope: 'chapters', level: 'full' },
  analyze_character_emotions: { scope: 'emotions', level: 'full' },
}

export const DATA_TYPE_SCOPE_MAP: Record<string, keyof AIAccessScope> = {
  characters: 'characters',
  world_settings: 'worldSettings',
  items: 'items',
  outline: 'chapters',
  foreshadows: 'foreshadows',
  relations: 'relations',
  chapter_content: 'chapters',
}

export function checkAIAccess(
  toolName: string,
  params: Record<string, any>,
  scope: AIAccessScope,
): string | null {
  if (toolName === 'get_current_state') {
    const dataType = params.dataType as string
    const scopeKey = DATA_TYPE_SCOPE_MAP[dataType]
    if (scopeKey && scope[scopeKey] === 'none') {
      return `AI의 '${dataType}' 데이터 접근이 비활성화되어 있습니다.`
    }
    return null
  }

  const req = TOOL_ACCESS_REQUIREMENTS[toolName]
  if (!req) return null

  const currentLevel = scope[req.scope]
  if (currentLevel === 'none') {
    return `AI의 '${req.scope}' 데이터 접근이 비활성화되어 있습니다.`
  }
  if (req.level === 'full' && currentLevel === 'read_only') {
    return `AI의 '${req.scope}' 데이터 수정 권한이 읽기 전용으로 설정되어 있습니다.`
  }
  return null
}
