/**
 * Unit tests for AI constants module.
 * Tests: resolveCategory, checkAIAccess, exported constants shape.
 */
import { describe, it, expect } from 'vitest'
import {
  CHARACTER_ROLES,
  WORLD_SETTING_CATEGORIES,
  CATEGORY_ALIAS_MAP,
  resolveCategory,
  FORESHADOW_STATUSES,
  FORESHADOW_IMPORTANCES,
  ITEM_TYPES,
  ITEM_RARITIES,
  EMOTION_TYPES,
  EMOTION_SCORE_MIN,
  EMOTION_SCORE_MAX,
  VERSIONABLE_ENTITY_TYPES,
  PROMPT_LIMITS,
  DEFAULT_AI_ACCESS_SCOPE,
  TOOL_ACCESS_REQUIREMENTS,
  DATA_TYPE_SCOPE_MAP,
  checkAIAccess,
  type AIAccessScope,
} from './constants'

// ── Exported Constants Shape ──

describe('constants: exported constants shape', () => {
  it('CHARACTER_ROLES contains expected roles', () => {
    expect(CHARACTER_ROLES).toContain('protagonist')
    expect(CHARACTER_ROLES).toContain('antagonist')
    expect(CHARACTER_ROLES).toContain('supporting')
    expect(CHARACTER_ROLES).toContain('minor')
    expect(CHARACTER_ROLES).toHaveLength(4)
  })

  it('WORLD_SETTING_CATEGORIES contains all 13 categories', () => {
    expect(WORLD_SETTING_CATEGORIES).toHaveLength(13)
    expect(WORLD_SETTING_CATEGORIES).toContain('magic')
    expect(WORLD_SETTING_CATEGORIES).toContain('technology')
    expect(WORLD_SETTING_CATEGORIES).toContain('geography')
    expect(WORLD_SETTING_CATEGORIES).toContain('politics')
    expect(WORLD_SETTING_CATEGORIES).toContain('culture')
    expect(WORLD_SETTING_CATEGORIES).toContain('history')
    expect(WORLD_SETTING_CATEGORIES).toContain('religion')
    expect(WORLD_SETTING_CATEGORIES).toContain('economy')
    expect(WORLD_SETTING_CATEGORIES).toContain('language')
    expect(WORLD_SETTING_CATEGORIES).toContain('species')
    expect(WORLD_SETTING_CATEGORIES).toContain('society')
    expect(WORLD_SETTING_CATEGORIES).toContain('disease')
    expect(WORLD_SETTING_CATEGORIES).toContain('other')
  })

  it('FORESHADOW_STATUSES contains expected statuses', () => {
    expect(FORESHADOW_STATUSES).toContain('planted')
    expect(FORESHADOW_STATUSES).toContain('hinted')
    expect(FORESHADOW_STATUSES).toContain('resolved')
    expect(FORESHADOW_STATUSES).toContain('abandoned')
    expect(FORESHADOW_STATUSES).toHaveLength(4)
  })

  it('FORESHADOW_IMPORTANCES contains expected importances', () => {
    expect(FORESHADOW_IMPORTANCES).toContain('low')
    expect(FORESHADOW_IMPORTANCES).toContain('medium')
    expect(FORESHADOW_IMPORTANCES).toContain('high')
    expect(FORESHADOW_IMPORTANCES).toContain('critical')
    expect(FORESHADOW_IMPORTANCES).toHaveLength(4)
  })

  it('ITEM_TYPES contains expected types', () => {
    expect(ITEM_TYPES).toContain('weapon')
    expect(ITEM_TYPES).toContain('armor')
    expect(ITEM_TYPES).toContain('consumable')
    expect(ITEM_TYPES).toContain('food')
    expect(ITEM_TYPES).toContain('accessory')
    expect(ITEM_TYPES).toContain('tool')
    expect(ITEM_TYPES).toContain('material')
    expect(ITEM_TYPES).toContain('other')
    expect(ITEM_TYPES).toHaveLength(8)
  })

  it('ITEM_RARITIES contains expected rarities', () => {
    expect(ITEM_RARITIES).toContain('common')
    expect(ITEM_RARITIES).toContain('uncommon')
    expect(ITEM_RARITIES).toContain('rare')
    expect(ITEM_RARITIES).toContain('epic')
    expect(ITEM_RARITIES).toContain('legendary')
    expect(ITEM_RARITIES).toContain('unique')
    expect(ITEM_RARITIES).toHaveLength(6)
  })

  it('EMOTION_TYPES contains expected emotions', () => {
    expect(EMOTION_TYPES).toContain('joy')
    expect(EMOTION_TYPES).toContain('sadness')
    expect(EMOTION_TYPES).toContain('anger')
    expect(EMOTION_TYPES).toContain('fear')
    expect(EMOTION_TYPES).toContain('surprise')
    expect(EMOTION_TYPES).toContain('love')
    expect(EMOTION_TYPES).toContain('tension')
    expect(EMOTION_TYPES).toContain('determination')
    expect(EMOTION_TYPES).toHaveLength(8)
  })

  it('EMOTION_SCORE boundaries are correct', () => {
    expect(EMOTION_SCORE_MIN).toBe(0)
    expect(EMOTION_SCORE_MAX).toBe(10)
  })

  it('VERSIONABLE_ENTITY_TYPES contains expected types', () => {
    expect(VERSIONABLE_ENTITY_TYPES).toContain('chapter')
    expect(VERSIONABLE_ENTITY_TYPES).toContain('character')
    expect(VERSIONABLE_ENTITY_TYPES).toContain('world_setting')
    expect(VERSIONABLE_ENTITY_TYPES).toContain('foreshadow')
    expect(VERSIONABLE_ENTITY_TYPES).toContain('outline')
    expect(VERSIONABLE_ENTITY_TYPES).toContain('relation')
    expect(VERSIONABLE_ENTITY_TYPES).toHaveLength(6)
  })

  it('PROMPT_LIMITS has all expected keys and positive values', () => {
    expect(PROMPT_LIMITS.WORLD_SETTING_CONTENT_PREVIEW).toBe(80)
    expect(PROMPT_LIMITS.REFERENCE_DATA_PREVIEW).toBe(300)
    expect(PROMPT_LIMITS.MAX_WORLD_SETTINGS).toBe(15)
    expect(PROMPT_LIMITS.MAX_ITEMS).toBe(15)
    expect(PROMPT_LIMITS.MAX_FORESHADOWS).toBe(10)
    expect(PROMPT_LIMITS.CURRENT_CHAPTER_PREVIEW).toBe(1000)
    expect(PROMPT_LIMITS.COMPACT_CONTENT_PREVIEW).toBe(40)
    expect(PROMPT_LIMITS.COMPACT_PERSONALITY_PREVIEW).toBe(25)
    expect(PROMPT_LIMITS.COMPACT_CHAPTER_PREVIEW).toBe(500)
    expect(PROMPT_LIMITS.COMPACT_MAX_CHARACTERS).toBe(3)
    expect(PROMPT_LIMITS.COMPACT_MAX_WORLD_SETTINGS).toBe(2)
    expect(PROMPT_LIMITS.COMPACT_MAX_ITEMS).toBe(2)
    expect(PROMPT_LIMITS.COMPACT_MAX_FORESHADOWS).toBe(2)
  })

  it('DEFAULT_AI_ACCESS_SCOPE has expected defaults', () => {
    expect(DEFAULT_AI_ACCESS_SCOPE.characters).toBe('full')
    expect(DEFAULT_AI_ACCESS_SCOPE.worldSettings).toBe('full')
    expect(DEFAULT_AI_ACCESS_SCOPE.items).toBe('full')
    expect(DEFAULT_AI_ACCESS_SCOPE.foreshadows).toBe('full')
    expect(DEFAULT_AI_ACCESS_SCOPE.chapters).toBe('full')
    expect(DEFAULT_AI_ACCESS_SCOPE.referenceData).toBe('read_only')
    expect(DEFAULT_AI_ACCESS_SCOPE.relations).toBe('full')
    expect(DEFAULT_AI_ACCESS_SCOPE.emotions).toBe('full')
  })

  it('TOOL_ACCESS_REQUIREMENTS maps tools to scopes and levels', () => {
    expect(TOOL_ACCESS_REQUIREMENTS.get_current_state).toEqual({ scope: 'characters', level: 'read_only' })
    expect(TOOL_ACCESS_REQUIREMENTS.update_character).toEqual({ scope: 'characters', level: 'full' })
    expect(TOOL_ACCESS_REQUIREMENTS.save_world_setting).toEqual({ scope: 'worldSettings', level: 'full' })
    expect(TOOL_ACCESS_REQUIREMENTS.write_chapter_content).toEqual({ scope: 'chapters', level: 'full' })
  })

  it('DATA_TYPE_SCOPE_MAP covers expected data types', () => {
    expect(DATA_TYPE_SCOPE_MAP.characters).toBe('characters')
    expect(DATA_TYPE_SCOPE_MAP.world_settings).toBe('worldSettings')
    expect(DATA_TYPE_SCOPE_MAP.items).toBe('items')
    expect(DATA_TYPE_SCOPE_MAP.outline).toBe('chapters')
    expect(DATA_TYPE_SCOPE_MAP.foreshadows).toBe('foreshadows')
    expect(DATA_TYPE_SCOPE_MAP.relations).toBe('relations')
    expect(DATA_TYPE_SCOPE_MAP.chapter_content).toBe('chapters')
  })

  it('CATEGORY_ALIAS_MAP is a non-empty record', () => {
    expect(Object.keys(CATEGORY_ALIAS_MAP).length).toBeGreaterThan(0)
  })
})

// ── resolveCategory ──

describe('resolveCategory', () => {
  describe('Korean aliases', () => {
    it('resolves "마법" to "magic"', () => {
      expect(resolveCategory('마법')).toBe('magic')
    })

    it('resolves "기술" to "technology"', () => {
      expect(resolveCategory('기술')).toBe('technology')
    })

    it('resolves "지리" to "geography"', () => {
      expect(resolveCategory('지리')).toBe('geography')
    })

    it('resolves "정치" to "politics"', () => {
      expect(resolveCategory('정치')).toBe('politics')
    })

    it('resolves "문화" to "culture"', () => {
      expect(resolveCategory('문화')).toBe('culture')
    })

    it('resolves "역사" to "history"', () => {
      expect(resolveCategory('역사')).toBe('history')
    })

    it('resolves "종교" to "religion"', () => {
      expect(resolveCategory('종교')).toBe('religion')
    })

    it('resolves "경제" to "economy"', () => {
      expect(resolveCategory('경제')).toBe('economy')
    })

    it('resolves "언어" to "language"', () => {
      expect(resolveCategory('언어')).toBe('language')
    })

    it('resolves "종족" to "species"', () => {
      expect(resolveCategory('종족')).toBe('species')
    })

    it('resolves "사회" to "society"', () => {
      expect(resolveCategory('사회')).toBe('society')
    })

    it('resolves "질병" to "disease"', () => {
      expect(resolveCategory('질병')).toBe('disease')
    })

    it('resolves "기타" to "other"', () => {
      expect(resolveCategory('기타')).toBe('other')
    })
  })

  describe('English aliases', () => {
    it('resolves "magic_system" to "magic"', () => {
      expect(resolveCategory('magic_system')).toBe('magic')
    })

    it('resolves "sorcery" to "magic"', () => {
      expect(resolveCategory('sorcery')).toBe('magic')
    })

    it('resolves "tech" to "technology"', () => {
      expect(resolveCategory('tech')).toBe('technology')
    })

    it('resolves "terrain" to "geography"', () => {
      expect(resolveCategory('terrain')).toBe('geography')
    })

    it('resolves "government" to "politics"', () => {
      expect(resolveCategory('government')).toBe('politics')
    })

    it('resolves "lore" to "history"', () => {
      expect(resolveCategory('lore')).toBe('history')
    })

    it('resolves "deity" to "religion"', () => {
      expect(resolveCategory('deity')).toBe('religion')
    })

    it('resolves "trade" to "economy"', () => {
      expect(resolveCategory('trade')).toBe('economy')
    })

    it('resolves "dialect" to "language"', () => {
      expect(resolveCategory('dialect')).toBe('language')
    })

    it('resolves "creature" to "species"', () => {
      expect(resolveCategory('creature')).toBe('species')
    })

    it('resolves "social" to "society"', () => {
      expect(resolveCategory('social')).toBe('society')
    })

    it('resolves "plague" to "disease"', () => {
      expect(resolveCategory('plague')).toBe('disease')
    })

    it('resolves "misc" to "other"', () => {
      expect(resolveCategory('misc')).toBe('other')
    })
  })

  describe('exact canonical names', () => {
    it('resolves "magic" to "magic" (exact match)', () => {
      expect(resolveCategory('magic')).toBe('magic')
    })

    it('resolves "technology" to "technology" (exact match)', () => {
      expect(resolveCategory('technology')).toBe('technology')
    })

    it('resolves "geography" to "geography" (exact match)', () => {
      expect(resolveCategory('geography')).toBe('geography')
    })

    it('resolves "other" to "other" (exact match)', () => {
      expect(resolveCategory('other')).toBe('other')
    })
  })

  describe('unknown and edge cases', () => {
    it('returns "other" for unknown input', () => {
      expect(resolveCategory('unknown_category')).toBe('other')
    })

    it('returns "other" for empty string', () => {
      expect(resolveCategory('')).toBe('other')
    })

    it('returns "other" for gibberish', () => {
      expect(resolveCategory('xyzzy123')).toBe('other')
    })

    it('handles alias lookup with case variation (lowercase)', () => {
      // aliases are lowercased: "Tech" -> toLowerCase() -> "tech" -> "technology"
      expect(resolveCategory('Tech')).toBe('technology')
    })

    it('handles alias lookup with uppercase', () => {
      expect(resolveCategory('SORCERY')).toBe('magic')
    })

    it('handles alias with leading/trailing whitespace', () => {
      expect(resolveCategory('  tech  ')).toBe('technology')
    })
  })
})

// ── checkAIAccess ──

describe('checkAIAccess', () => {
  const fullScope: AIAccessScope = {
    characters: 'full',
    worldSettings: 'full',
    items: 'full',
    foreshadows: 'full',
    chapters: 'full',
    referenceData: 'full',
    relations: 'full',
    emotions: 'full',
    wiki: 'full',
  }

  const readOnlyScope: AIAccessScope = {
    characters: 'read_only',
    worldSettings: 'read_only',
    items: 'read_only',
    foreshadows: 'read_only',
    chapters: 'read_only',
    referenceData: 'read_only',
    relations: 'read_only',
    emotions: 'read_only',
    wiki: 'read_only',
  }

  const noneScope: AIAccessScope = {
    characters: 'none',
    worldSettings: 'none',
    items: 'none',
    foreshadows: 'none',
    chapters: 'none',
    referenceData: 'none',
    relations: 'none',
    emotions: 'none',
    wiki: 'none',
  }

  describe('full scope allows all tools', () => {
    it('allows get_current_state with full scope', () => {
      expect(checkAIAccess('get_current_state', { dataType: 'characters' }, fullScope)).toBeNull()
    })

    it('allows update_character with full scope', () => {
      expect(checkAIAccess('update_character', {}, fullScope)).toBeNull()
    })

    it('allows save_world_setting with full scope', () => {
      expect(checkAIAccess('save_world_setting', {}, fullScope)).toBeNull()
    })

    it('allows delete_character with full scope', () => {
      expect(checkAIAccess('delete_character', {}, fullScope)).toBeNull()
    })

    it('allows write_chapter_content with full scope', () => {
      expect(checkAIAccess('write_chapter_content', {}, fullScope)).toBeNull()
    })

    it('allows save_foreshadow with full scope', () => {
      expect(checkAIAccess('save_foreshadow', {}, fullScope)).toBeNull()
    })

    it('allows save_item with full scope', () => {
      expect(checkAIAccess('save_item', {}, fullScope)).toBeNull()
    })

    it('allows analyze_character_emotions with full scope', () => {
      expect(checkAIAccess('analyze_character_emotions', {}, fullScope)).toBeNull()
    })
  })

  describe('read_only scope allows read tools, blocks write tools', () => {
    it('allows get_current_state with read_only scope (read tool)', () => {
      expect(checkAIAccess('get_current_state', { dataType: 'characters' }, readOnlyScope)).toBeNull()
    })

    it('blocks update_character with read_only scope (write tool)', () => {
      const result = checkAIAccess('update_character', {}, readOnlyScope)
      expect(result).not.toBeNull()
      expect(result).toContain('읽기 전용')
    })

    it('blocks delete_character with read_only scope (write tool)', () => {
      const result = checkAIAccess('delete_character', {}, readOnlyScope)
      expect(result).not.toBeNull()
      expect(result).toContain('읽기 전용')
    })

    it('blocks save_world_setting with read_only scope (write tool)', () => {
      const result = checkAIAccess('save_world_setting', {}, readOnlyScope)
      expect(result).not.toBeNull()
      expect(result).toContain('읽기 전용')
    })

    it('blocks write_chapter_content with read_only scope (write tool)', () => {
      const result = checkAIAccess('write_chapter_content', {}, readOnlyScope)
      expect(result).not.toBeNull()
      expect(result).toContain('읽기 전용')
    })

    it('blocks save_foreshadow with read_only scope', () => {
      const result = checkAIAccess('save_foreshadow', {}, readOnlyScope)
      expect(result).not.toBeNull()
    })

    it('blocks save_item with read_only scope', () => {
      const result = checkAIAccess('save_item', {}, readOnlyScope)
      expect(result).not.toBeNull()
    })
  })

  describe('none scope blocks all tools', () => {
    it('blocks get_current_state with none scope', () => {
      const result = checkAIAccess('get_current_state', { dataType: 'characters' }, noneScope)
      expect(result).not.toBeNull()
      expect(result).toContain('비활성화')
    })

    it('blocks update_character with none scope', () => {
      const result = checkAIAccess('update_character', {}, noneScope)
      expect(result).not.toBeNull()
      expect(result).toContain('비활성화')
    })

    it('blocks save_world_setting with none scope', () => {
      const result = checkAIAccess('save_world_setting', {}, noneScope)
      expect(result).not.toBeNull()
      expect(result).toContain('비활성화')
    })

    it('blocks delete_item with none scope', () => {
      const result = checkAIAccess('delete_item', {}, noneScope)
      expect(result).not.toBeNull()
      expect(result).toContain('비활성화')
    })

    it('blocks write_chapter_content with none scope', () => {
      const result = checkAIAccess('write_chapter_content', {}, noneScope)
      expect(result).not.toBeNull()
    })
  })

  describe('get_current_state special handling', () => {
    it('allows reading characters when characters scope is read_only', () => {
      const scope: AIAccessScope = { ...fullScope, characters: 'read_only' }
      expect(checkAIAccess('get_current_state', { dataType: 'characters' }, scope)).toBeNull()
    })

    it('blocks reading characters when characters scope is none', () => {
      const scope: AIAccessScope = { ...fullScope, characters: 'none' }
      const result = checkAIAccess('get_current_state', { dataType: 'characters' }, scope)
      expect(result).not.toBeNull()
    })

    it('allows reading world_settings when worldSettings scope is full', () => {
      expect(checkAIAccess('get_current_state', { dataType: 'world_settings' }, fullScope)).toBeNull()
    })

    it('blocks reading world_settings when worldSettings scope is none', () => {
      const scope: AIAccessScope = { ...fullScope, worldSettings: 'none' }
      const result = checkAIAccess('get_current_state', { dataType: 'world_settings' }, scope)
      expect(result).not.toBeNull()
    })

    it('allows unmapped dataType (no restriction)', () => {
      expect(checkAIAccess('get_current_state', { dataType: 'unknown_type' }, noneScope)).toBeNull()
    })
  })

  describe('unknown tool name', () => {
    it('returns null for unknown tool name (no restriction)', () => {
      expect(checkAIAccess('some_unknown_tool', {}, noneScope)).toBeNull()
    })
  })

  describe('mixed scopes', () => {
    it('allows character read but blocks chapter write', () => {
      const scope: AIAccessScope = {
        ...fullScope,
        characters: 'read_only',
        chapters: 'read_only',
      }
      expect(checkAIAccess('get_current_state', { dataType: 'characters' }, scope)).toBeNull()
      const result = checkAIAccess('write_chapter_content', {}, scope)
      expect(result).not.toBeNull()
    })
  })
})
