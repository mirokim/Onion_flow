/**
 * Unit tests for AI tool parameter validation (Zod schemas + validateToolParams).
 * Pure function tests -- no mocks.
 */
import { describe, it, expect } from 'vitest'
import {
  saveOutlineSchema,
  updateCharacterSchema,
  saveWorldSettingSchema,
  saveRelationSchema,
  saveForeshadowSchema,
  saveItemSchema,
  deleteCharacterSchema,
  deleteWorldSettingSchema,
  deleteItemSchema,
  deleteForeshadowSchema,
  createVersionSnapshotSchema,
  getCurrentStateSchema,
  writeChapterContentSchema,
  appendToChapterSchema,
  createChapterSchema,
  createVolumeSchema,
  renameChapterSchema,
  analyzeCharacterEmotionsSchema,
  respondSchema,
  validateToolParams,
} from '@/ai/toolValidation'

// ── safeString: HTML stripping ──

describe('safeString HTML stripping', () => {
  it('strips simple HTML tags from a string', () => {
    const result = saveOutlineSchema.parse({ chapterId: 'ch1', synopsis: '<b>test</b>' })
    expect(result.synopsis).toBe('test')
  })

  it('strips nested HTML tags', () => {
    const result = updateCharacterSchema.parse({ name: '<div><span>Hero</span></div>' })
    expect(result.name).toBe('Hero')
  })

  it('leaves plain text unchanged', () => {
    const result = saveOutlineSchema.parse({ chapterId: 'ch1', synopsis: 'no tags here' })
    expect(result.synopsis).toBe('no tags here')
  })

  it('strips HTML from optional safeString fields', () => {
    const result = updateCharacterSchema.parse({
      name: 'Alice',
      personality: '<em>brave</em> and <strong>kind</strong>',
    })
    expect(result.personality).toBe('brave and kind')
  })

  it('strips HTML from tags array elements', () => {
    const result = updateCharacterSchema.parse({
      name: 'Bob',
      tags: ['<b>warrior</b>', '<i>mage</i>'],
    })
    expect(result.tags).toEqual(['warrior', 'mage'])
  })
})

// ── Required fields with Korean error messages ──

describe('required field validation', () => {
  it('saveOutlineSchema fails when chapterId is missing', () => {
    const result = saveOutlineSchema.safeParse({ synopsis: 'text' })
    expect(result.success).toBe(false)
  })

  it('saveOutlineSchema fails when chapterId is empty with Korean message', () => {
    const result = saveOutlineSchema.safeParse({ chapterId: '', synopsis: 'text' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('chapterId는 필수입니다')
    }
  })

  it('updateCharacterSchema fails when name is missing', () => {
    const result = updateCharacterSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('updateCharacterSchema fails when name is empty after HTML strip', () => {
    const result = updateCharacterSchema.safeParse({ name: '<br>' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map(i => i.message)
      expect(msgs.some(m => m.includes('이름은 필수입니다'))).toBe(true)
    }
  })

  it('saveWorldSettingSchema fails when category is empty with Korean message', () => {
    const result = saveWorldSettingSchema.safeParse({ category: '', title: 'A', content: 'B' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map(i => i.message)
      expect(msgs.some(m => m.includes('카테고리는 필수입니다'))).toBe(true)
    }
  })

  it('saveWorldSettingSchema fails when title is empty with Korean message', () => {
    const result = saveWorldSettingSchema.safeParse({ category: 'magic', title: '', content: 'B' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map(i => i.message)
      expect(msgs.some(m => m.includes('제목은 필수입니다'))).toBe(true)
    }
  })

  it('saveForeshadowSchema fails when title is empty with Korean message', () => {
    const result = saveForeshadowSchema.safeParse({ title: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map(i => i.message)
      expect(msgs.some(m => m.includes('제목은 필수입니다'))).toBe(true)
    }
  })

  it('saveItemSchema fails when name is empty with Korean message', () => {
    const result = saveItemSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      const msgs = result.error.issues.map(i => i.message)
      expect(msgs.some(m => m.includes('이름은 필수입니다'))).toBe(true)
    }
  })

  it('deleteCharacterSchema fails with empty characterId', () => {
    expect(deleteCharacterSchema.safeParse({ characterId: '' }).success).toBe(false)
  })

  it('deleteWorldSettingSchema fails with empty settingId', () => {
    expect(deleteWorldSettingSchema.safeParse({ settingId: '' }).success).toBe(false)
  })

  it('deleteItemSchema fails with empty itemId', () => {
    expect(deleteItemSchema.safeParse({ itemId: '' }).success).toBe(false)
  })

  it('deleteForeshadowSchema fails with empty foreshadowId', () => {
    expect(deleteForeshadowSchema.safeParse({ foreshadowId: '' }).success).toBe(false)
  })
})

// ── Enum validation ──

describe('enum validation', () => {
  describe('CHARACTER_ROLES', () => {
    it.each(['protagonist', 'antagonist', 'supporting', 'minor'] as const)(
      'accepts valid role "%s"',
      (role) => {
        const result = updateCharacterSchema.safeParse({ name: 'A', role })
        expect(result.success).toBe(true)
      },
    )

    it('rejects invalid role', () => {
      const result = updateCharacterSchema.safeParse({ name: 'A', role: 'villain' })
      expect(result.success).toBe(false)
    })
  })

  describe('FORESHADOW_STATUSES', () => {
    it.each(['planted', 'hinted', 'resolved', 'abandoned'] as const)(
      'accepts valid status "%s"',
      (status) => {
        const result = saveForeshadowSchema.safeParse({ title: 'F', status })
        expect(result.success).toBe(true)
      },
    )

    it('rejects invalid status', () => {
      const result = saveForeshadowSchema.safeParse({ title: 'F', status: 'active' })
      expect(result.success).toBe(false)
    })
  })

  describe('ITEM_TYPES', () => {
    it.each(['weapon', 'armor', 'consumable', 'food', 'accessory', 'tool', 'material', 'other'] as const)(
      'accepts valid itemType "%s"',
      (itemType) => {
        const result = saveItemSchema.safeParse({ name: 'Sword', itemType })
        expect(result.success).toBe(true)
      },
    )

    it('rejects invalid itemType', () => {
      const result = saveItemSchema.safeParse({ name: 'Sword', itemType: 'spell' })
      expect(result.success).toBe(false)
    })
  })

  describe('ITEM_RARITIES', () => {
    it.each(['common', 'uncommon', 'rare', 'epic', 'legendary', 'unique'] as const)(
      'accepts valid rarity "%s"',
      (rarity) => {
        const result = saveItemSchema.safeParse({ name: 'Sword', rarity })
        expect(result.success).toBe(true)
      },
    )

    it('rejects invalid rarity', () => {
      const result = saveItemSchema.safeParse({ name: 'Sword', rarity: 'mythic' })
      expect(result.success).toBe(false)
    })
  })
})

// ── Optional fields ──

describe('optional fields', () => {
  it('updateCharacterSchema passes with only required name', () => {
    const result = updateCharacterSchema.safeParse({ name: 'Alice' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('Alice')
      expect(result.data.characterId).toBeUndefined()
      expect(result.data.role).toBeUndefined()
      expect(result.data.personality).toBeUndefined()
      expect(result.data.tags).toBeUndefined()
      expect(result.data.notes).toBeUndefined()
    }
  })

  it('saveItemSchema passes with only required name', () => {
    const result = saveItemSchema.safeParse({ name: 'Potion' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.itemType).toBeUndefined()
      expect(result.data.rarity).toBeUndefined()
      expect(result.data.effect).toBeUndefined()
      expect(result.data.tags).toBeUndefined()
    }
  })

  it('saveForeshadowSchema passes with only required title', () => {
    const result = saveForeshadowSchema.safeParse({ title: 'The prophecy' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.status).toBeUndefined()
      expect(result.data.importance).toBeUndefined()
      expect(result.data.plantedChapterId).toBeUndefined()
      expect(result.data.resolvedChapterId).toBeUndefined()
    }
  })

  it('saveRelationSchema passes with only required fields', () => {
    const result = saveRelationSchema.safeParse({
      sourceName: 'Alice',
      targetName: 'Bob',
      relationType: 'friend',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.description).toBeUndefined()
      expect(result.data.isBidirectional).toBeUndefined()
      expect(result.data.relationId).toBeUndefined()
    }
  })

  it('saveOutlineSchema versionLabel is optional', () => {
    const result = saveOutlineSchema.safeParse({ chapterId: 'ch1', synopsis: 'text' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.versionLabel).toBeUndefined()
    }
  })

  it('createChapterSchema content, synopsis, parentId are optional', () => {
    const result = createChapterSchema.safeParse({ title: 'Chapter 1' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.content).toBeUndefined()
      expect(result.data.synopsis).toBeUndefined()
      expect(result.data.parentId).toBeUndefined()
    }
  })

  it('getCurrentStateSchema entityId is optional', () => {
    const result = getCurrentStateSchema.safeParse({ dataType: 'characters' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.entityId).toBeUndefined()
    }
  })

  it('writeChapterContentSchema versionLabel is optional', () => {
    const result = writeChapterContentSchema.safeParse({ chapterId: 'ch1', content: 'text' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.versionLabel).toBeUndefined()
    }
  })
})

// ── Tags arrays ──

describe('tags arrays', () => {
  it('accepts tags on updateCharacterSchema', () => {
    const result = updateCharacterSchema.parse({ name: 'Hero', tags: ['brave', 'strong'] })
    expect(result.tags).toEqual(['brave', 'strong'])
  })

  it('accepts tags on saveWorldSettingSchema', () => {
    const result = saveWorldSettingSchema.parse({
      category: 'magic',
      title: 'Fire',
      content: 'Burns',
      tags: ['elemental'],
    })
    expect(result.tags).toEqual(['elemental'])
  })

  it('accepts tags on saveItemSchema', () => {
    const result = saveItemSchema.parse({ name: 'Ring', tags: ['jewelry', 'enchanted'] })
    expect(result.tags).toEqual(['jewelry', 'enchanted'])
  })

  it('accepts empty tags array', () => {
    const result = updateCharacterSchema.parse({ name: 'Hero', tags: [] })
    expect(result.tags).toEqual([])
  })
})

// ── respondSchema default ──

describe('respondSchema', () => {
  it('defaults message to empty string when message is omitted', () => {
    const result = respondSchema.parse({})
    expect(result.message).toBe('')
  })

  it('accepts an explicit message', () => {
    const result = respondSchema.parse({ message: 'hello' })
    expect(result.message).toBe('hello')
  })
})

// ── Other schemas: valid data acceptance ──

describe('schema valid data acceptance', () => {
  it('createVersionSnapshotSchema accepts valid data', () => {
    const result = createVersionSnapshotSchema.safeParse({
      entityType: 'chapter',
      entityId: 'e1',
      label: 'v1',
    })
    expect(result.success).toBe(true)
  })

  it('createVersionSnapshotSchema rejects invalid entityType', () => {
    const result = createVersionSnapshotSchema.safeParse({
      entityType: 'unknown',
      entityId: 'e1',
      label: 'v1',
    })
    expect(result.success).toBe(false)
  })

  it('createVersionSnapshotSchema rejects empty label after HTML strip', () => {
    const result = createVersionSnapshotSchema.safeParse({
      entityType: 'chapter',
      entityId: 'ch1',
      label: '<i></i>',
    })
    expect(result.success).toBe(false)
  })

  it('getCurrentStateSchema accepts valid dataType', () => {
    expect(getCurrentStateSchema.safeParse({ dataType: 'characters' }).success).toBe(true)
    expect(getCurrentStateSchema.safeParse({ dataType: 'world_settings' }).success).toBe(true)
    expect(getCurrentStateSchema.safeParse({ dataType: 'items' }).success).toBe(true)
    expect(getCurrentStateSchema.safeParse({ dataType: 'outline' }).success).toBe(true)
    expect(getCurrentStateSchema.safeParse({ dataType: 'foreshadows' }).success).toBe(true)
    expect(getCurrentStateSchema.safeParse({ dataType: 'relations' }).success).toBe(true)
    expect(getCurrentStateSchema.safeParse({ dataType: 'chapter_content' }).success).toBe(true)
  })

  it('getCurrentStateSchema rejects invalid dataType', () => {
    expect(getCurrentStateSchema.safeParse({ dataType: 'unknown' }).success).toBe(false)
  })

  it('writeChapterContentSchema accepts valid data', () => {
    const result = writeChapterContentSchema.safeParse({ chapterId: 'ch1', content: 'The story' })
    expect(result.success).toBe(true)
  })

  it('writeChapterContentSchema rejects empty content', () => {
    expect(writeChapterContentSchema.safeParse({ chapterId: 'ch1', content: '' }).success).toBe(false)
  })

  it('appendToChapterSchema accepts valid data', () => {
    const result = appendToChapterSchema.safeParse({ chapterId: 'ch1', content: 'More text' })
    expect(result.success).toBe(true)
  })

  it('appendToChapterSchema rejects empty chapterId', () => {
    expect(appendToChapterSchema.safeParse({ chapterId: '', content: 'text' }).success).toBe(false)
  })

  it('createVolumeSchema accepts valid data', () => {
    expect(createVolumeSchema.safeParse({ title: 'Volume 1' }).success).toBe(true)
  })

  it('createVolumeSchema rejects empty title', () => {
    expect(createVolumeSchema.safeParse({ title: '' }).success).toBe(false)
  })

  it('renameChapterSchema accepts valid data', () => {
    const result = renameChapterSchema.safeParse({ chapterId: 'ch1', newTitle: 'New Title' })
    expect(result.success).toBe(true)
  })

  it('renameChapterSchema rejects empty newTitle', () => {
    expect(renameChapterSchema.safeParse({ chapterId: 'ch1', newTitle: '' }).success).toBe(false)
  })

  it('analyzeCharacterEmotionsSchema accepts valid data', () => {
    const result = analyzeCharacterEmotionsSchema.safeParse({
      characterName: 'Alice',
      chapterEmotions: [{ chapterId: 'ch1', joy: 5, sadness: 2 }],
    })
    expect(result.success).toBe(true)
  })

  it('analyzeCharacterEmotionsSchema rejects empty chapterEmotions', () => {
    const result = analyzeCharacterEmotionsSchema.safeParse({
      characterName: 'Alice',
      chapterEmotions: [],
    })
    expect(result.success).toBe(false)
  })

  it('analyzeCharacterEmotionsSchema rejects missing characterName', () => {
    const result = analyzeCharacterEmotionsSchema.safeParse({
      chapterEmotions: [{ chapterId: 'ch1' }],
    })
    expect(result.success).toBe(false)
  })
})

// ── validateToolParams ──

describe('validateToolParams', () => {
  it('returns success with transformed data for valid params', () => {
    const result = validateToolParams('save_outline', {
      chapterId: 'ch1',
      synopsis: '<b>bold</b> text',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.synopsis).toBe('bold text')
      expect(result.data.chapterId).toBe('ch1')
    }
  })

  it('returns error for invalid params', () => {
    const result = validateToolParams('save_outline', { synopsis: 'text' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('파라미터 검증 실패')
    }
  })

  it('error message includes the field path', () => {
    const result = validateToolParams('save_outline', { chapterId: '', synopsis: 'text' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('chapterId')
    }
  })

  it('returns data as-is for unknown tool names', () => {
    const params = { foo: 'bar', num: 42 }
    const result = validateToolParams('nonexistent_tool', params)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe(params)
    }
  })

  it('validates update_character with valid role', () => {
    const result = validateToolParams('update_character', { name: 'Hero', role: 'protagonist' })
    expect(result.success).toBe(true)
  })

  it('returns error for update_character with invalid role', () => {
    const result = validateToolParams('update_character', { name: 'Hero', role: 'villain' })
    expect(result.success).toBe(false)
  })

  it('validates respond with empty object (default message)', () => {
    const result = validateToolParams('respond', {})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.message).toBe('')
    }
  })

  it('validates all delete schemas with valid ids', () => {
    expect(validateToolParams('delete_character', { characterId: 'c1' }).success).toBe(true)
    expect(validateToolParams('delete_world_setting', { settingId: 's1' }).success).toBe(true)
    expect(validateToolParams('delete_item', { itemId: 'i1' }).success).toBe(true)
    expect(validateToolParams('delete_foreshadow', { foreshadowId: 'f1' }).success).toBe(true)
  })

  it('validates all delete schemas reject empty ids', () => {
    expect(validateToolParams('delete_character', { characterId: '' }).success).toBe(false)
    expect(validateToolParams('delete_world_setting', { settingId: '' }).success).toBe(false)
    expect(validateToolParams('delete_item', { itemId: '' }).success).toBe(false)
    expect(validateToolParams('delete_foreshadow', { foreshadowId: '' }).success).toBe(false)
  })

  it('validates create_chapter with minimal fields', () => {
    const result = validateToolParams('create_chapter', { title: 'Chapter 1' })
    expect(result.success).toBe(true)
  })

  it('validates create_volume', () => {
    const result = validateToolParams('create_volume', { title: 'Vol 1' })
    expect(result.success).toBe(true)
  })

  it('validates rename_chapter', () => {
    const result = validateToolParams('rename_chapter', { chapterId: 'ch1', newTitle: 'New' })
    expect(result.success).toBe(true)
  })

  it('validates get_current_state', () => {
    const result = validateToolParams('get_current_state', { dataType: 'characters' })
    expect(result.success).toBe(true)
  })

  it('validates write_chapter_content', () => {
    const result = validateToolParams('write_chapter_content', { chapterId: 'ch1', content: 'text' })
    expect(result.success).toBe(true)
  })

  it('validates append_to_chapter', () => {
    const result = validateToolParams('append_to_chapter', { chapterId: 'ch1', content: 'more' })
    expect(result.success).toBe(true)
  })

  it('validates save_relation', () => {
    const result = validateToolParams('save_relation', {
      sourceName: 'A',
      targetName: 'B',
      relationType: 'rival',
    })
    expect(result.success).toBe(true)
  })

  it('validates save_foreshadow', () => {
    const result = validateToolParams('save_foreshadow', { title: 'Hint' })
    expect(result.success).toBe(true)
  })

  it('validates save_item', () => {
    const result = validateToolParams('save_item', { name: 'Sword' })
    expect(result.success).toBe(true)
  })

  it('validates save_world_setting', () => {
    const result = validateToolParams('save_world_setting', {
      category: 'magic',
      title: 'Fire',
      content: 'Burns',
    })
    expect(result.success).toBe(true)
  })

  it('validates analyze_character_emotions', () => {
    const result = validateToolParams('analyze_character_emotions', {
      characterName: 'Alice',
      chapterEmotions: [{ chapterId: 'ch1' }],
    })
    expect(result.success).toBe(true)
  })

  it('validates create_version_snapshot', () => {
    const result = validateToolParams('create_version_snapshot', {
      entityType: 'chapter',
      entityId: 'ch1',
      label: 'v1',
    })
    expect(result.success).toBe(true)
  })
})
