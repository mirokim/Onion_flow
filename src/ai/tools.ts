/**
 * AI Tool definitions for function calling.
 * Ported from onion_editor with Onion Flow canvas extensions.
 */
import {
  CHARACTER_ROLES,
  WORLD_SETTING_CATEGORIES,
  FORESHADOW_STATUSES,
  FORESHADOW_IMPORTANCES,
  ITEM_TYPES,
  ITEM_RARITIES,
  VERSIONABLE_ENTITY_TYPES,
  EMOTION_TYPES,
} from './constants'

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

export const AI_TOOLS: ToolDefinition[] = [
  {
    name: 'save_outline',
    description: '챕터의 아웃라인/시놉시스를 저장합니다.',
    parameters: {
      type: 'object',
      properties: {
        chapterId: { type: 'string', description: '챕터 ID' },
        synopsis: { type: 'string', description: '아웃라인/시놉시스 텍스트' },
        versionLabel: { type: 'string', description: '버전 라벨' },
      },
      required: ['chapterId', 'synopsis'],
    },
  },
  {
    name: 'update_character',
    description: '인물을 생성하거나 수정합니다.',
    parameters: {
      type: 'object',
      properties: {
        characterId: { type: 'string', description: '기존 인물 ID (새 인물이면 생략)' },
        name: { type: 'string', description: '인물 이름' },
        role: { type: 'string', enum: [...CHARACTER_ROLES] },
        personality: { type: 'string' },
        abilities: { type: 'string' },
        appearance: { type: 'string' },
        background: { type: 'string' },
        motivation: { type: 'string' },
        speechPattern: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'save_world_setting',
    description: '세계관 설정을 생성하거나 수정합니다.',
    parameters: {
      type: 'object',
      properties: {
        settingId: { type: 'string' },
        category: { type: 'string', enum: [...WORLD_SETTING_CATEGORIES] },
        title: { type: 'string' },
        content: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['category', 'title', 'content'],
    },
  },
  {
    name: 'save_relation',
    description: '인물 간 관계를 생성하거나 수정합니다.',
    parameters: {
      type: 'object',
      properties: {
        relationId: { type: 'string' },
        sourceName: { type: 'string' },
        targetName: { type: 'string' },
        relationType: { type: 'string' },
        description: { type: 'string' },
        isBidirectional: { type: 'boolean' },
      },
      required: ['sourceName', 'targetName', 'relationType'],
    },
  },
  {
    name: 'save_foreshadow',
    description: '복선을 생성하거나 수정합니다.',
    parameters: {
      type: 'object',
      properties: {
        foreshadowId: { type: 'string' },
        title: { type: 'string' },
        description: { type: 'string' },
        status: { type: 'string', enum: [...FORESHADOW_STATUSES] },
        importance: { type: 'string', enum: [...FORESHADOW_IMPORTANCES] },
        plantedChapterId: { type: 'string' },
        resolvedChapterId: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'save_item',
    description: '아이템을 생성하거나 수정합니다.',
    parameters: {
      type: 'object',
      properties: {
        itemId: { type: 'string' },
        name: { type: 'string' },
        itemType: { type: 'string', enum: [...ITEM_TYPES] },
        rarity: { type: 'string', enum: [...ITEM_RARITIES] },
        effect: { type: 'string' },
        description: { type: 'string' },
        owner: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        notes: { type: 'string' },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_character',
    description: '인물을 삭제합니다.',
    parameters: { type: 'object', properties: { characterId: { type: 'string' } }, required: ['characterId'] },
  },
  {
    name: 'delete_world_setting',
    description: '세계관 설정을 삭제합니다.',
    parameters: { type: 'object', properties: { settingId: { type: 'string' } }, required: ['settingId'] },
  },
  {
    name: 'delete_item',
    description: '아이템을 삭제합니다.',
    parameters: { type: 'object', properties: { itemId: { type: 'string' } }, required: ['itemId'] },
  },
  {
    name: 'delete_foreshadow',
    description: '복선을 삭제합니다.',
    parameters: { type: 'object', properties: { foreshadowId: { type: 'string' } }, required: ['foreshadowId'] },
  },
  {
    name: 'create_version_snapshot',
    description: '특정 엔티티의 현재 상태를 버전으로 저장합니다.',
    parameters: {
      type: 'object',
      properties: {
        entityType: { type: 'string', enum: [...VERSIONABLE_ENTITY_TYPES] },
        entityId: { type: 'string' },
        label: { type: 'string' },
      },
      required: ['entityType', 'entityId', 'label'],
    },
  },
  {
    name: 'get_current_state',
    description: '현재 프로젝트의 데이터를 조회합니다.',
    parameters: {
      type: 'object',
      properties: {
        dataType: { type: 'string', enum: ['characters', 'world_settings', 'items', 'outline', 'foreshadows', 'relations', 'chapter_content'] },
        entityId: { type: 'string' },
      },
      required: ['dataType'],
    },
  },
  {
    name: 'write_chapter_content',
    description: '챕터 본문을 작성합니다. 기존 내용을 완전히 교체합니다.',
    parameters: {
      type: 'object',
      properties: {
        chapterId: { type: 'string' },
        content: { type: 'string' },
        versionLabel: { type: 'string' },
      },
      required: ['chapterId', 'content'],
    },
  },
  {
    name: 'append_to_chapter',
    description: '기존 챕터 뒤에 내용을 추가합니다.',
    parameters: {
      type: 'object',
      properties: {
        chapterId: { type: 'string' },
        content: { type: 'string' },
      },
      required: ['chapterId', 'content'],
    },
  },
  {
    name: 'create_chapter',
    description: '새 챕터를 생성합니다.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        content: { type: 'string' },
        synopsis: { type: 'string' },
        parentId: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_volume',
    description: '새 권(볼륨)을 생성합니다.',
    parameters: {
      type: 'object',
      properties: { title: { type: 'string' } },
      required: ['title'],
    },
  },
  {
    name: 'rename_chapter',
    description: '챕터 또는 권의 제목을 변경합니다.',
    parameters: {
      type: 'object',
      properties: {
        chapterId: { type: 'string' },
        newTitle: { type: 'string' },
      },
      required: ['chapterId', 'newTitle'],
    },
  },
  {
    name: 'analyze_character_emotions',
    description: `캐릭터의 감정을 분석하여 데이터를 저장합니다. 감정 종류: ${EMOTION_TYPES.join(', ')}`,
    parameters: {
      type: 'object',
      properties: {
        characterName: { type: 'string' },
        chapterEmotions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              chapterId: { type: 'string' },
              ...Object.fromEntries(EMOTION_TYPES.map(e => [e, { type: 'number' }])),
            },
            required: ['chapterId'],
          },
        },
      },
      required: ['characterName', 'chapterEmotions'],
    },
  },
  {
    name: 'respond',
    description: '사용자에게 텍스트로 응답합니다.',
    parameters: {
      type: 'object',
      properties: { message: { type: 'string' } },
      required: ['message'],
    },
  },
]

// ── Format Converters ──

export function toOpenAITools() {
  return AI_TOOLS.map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }))
}

export function toOpenAIToolsCompact() {
  const LOCAL_NAMES = new Set(['update_character', 'save_world_setting', 'save_item', 'append_to_chapter', 'save_foreshadow'])
  return AI_TOOLS.filter(t => LOCAL_NAMES.has(t.name)).map(t => ({
    type: 'function' as const,
    function: { name: t.name, description: t.description.split('.')[0], parameters: t.parameters },
  }))
}

export function toAnthropicTools() {
  return AI_TOOLS.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }))
}

export function toGeminiTools() {
  return [{
    function_declarations: AI_TOOLS.map(t => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  }]
}
