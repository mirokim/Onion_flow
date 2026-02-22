/**
 * Tool execution pipeline with validation, access control, and conflict detection.
 * Ported from onion_editor.
 */
import { useWorldStore } from '@/stores/worldStore'
import { useUserEditLogStore, type EditableEntityType, type UserEditLogEntry } from '@/stores/userEditLogStore'
import { validateToolParams } from './toolValidation'
import { checkAIAccess, type AIAccessScope, DEFAULT_AI_ACCESS_SCOPE } from './constants'
import { TOOL_HANDLERS } from './toolHandlers'

export interface ToolExecutionResult {
  success: boolean
  result: string
}

const _queriedChapterIds = new Set<string>()
export function resetQueriedChapterIds() { _queriedChapterIds.clear() }
export function markChapterQueried(chapterId: string) { _queriedChapterIds.add(chapterId) }
export function wasChapterQueried(chapterId: string): boolean { return _queriedChapterIds.has(chapterId) }

const TOOL_ENTITY_MAP: Record<string, {
  entityType: EditableEntityType
  getEntityId: (params: Record<string, any>) => string | null
  getEntityName: (params: Record<string, any>) => string
}> = {
  update_character: {
    entityType: 'character',
    getEntityId: (p) => p.characterId || null,
    getEntityName: (p) => p.name || '',
  },
  save_world_setting: {
    entityType: 'world_setting',
    getEntityId: (p) => p.settingId || null,
    getEntityName: (p) => p.title || '',
  },
  save_relation: {
    entityType: 'relation',
    getEntityId: (p) => p.relationId || null,
    getEntityName: (p) => `${p.sourceName || ''} → ${p.targetName || ''}`,
  },
  save_foreshadow: {
    entityType: 'foreshadow',
    getEntityId: (p) => p.foreshadowId || null,
    getEntityName: (p) => p.title || '',
  },
  save_item: {
    entityType: 'item',
    getEntityId: (p) => p.itemId || null,
    getEntityName: (p) => p.name || '',
  },
  analyze_character_emotions: {
    entityType: 'emotion',
    getEntityId: (p) => {
      const chars = useWorldStore.getState().characters
      const char = chars.find(c => c.name === p.characterName)
      return char?.id || null
    },
    getEntityName: (p) => p.characterName || '',
  },
}

function checkUserEditConflict(
  toolName: string,
  params: Record<string, any>,
): { entityType: EditableEntityType; entityId: string; entityName: string; logs: UserEditLogEntry[] } | null {
  const mapping = TOOL_ENTITY_MAP[toolName]
  if (!mapping) return null
  const entityId = mapping.getEntityId(params)
  if (!entityId) return null
  const logs = useUserEditLogStore.getState().getLogsForEntity(mapping.entityType, entityId)
  if (logs.length === 0) return null
  return { entityType: mapping.entityType, entityId, entityName: mapping.getEntityName(params), logs }
}

function requestUserConfirmation(
  toolName: string,
  params: Record<string, any>,
  conflict: { entityType: EditableEntityType; entityId: string; entityName: string; logs: UserEditLogEntry[] },
): Promise<{ confirmed: boolean; excludeFields?: string[] }> {
  return new Promise((resolve) => {
    useUserEditLogStore.getState().setPendingConfirmation({
      id: `confirm_${Date.now()}`,
      toolName,
      params,
      entityType: conflict.entityType,
      entityId: conflict.entityId,
      entityName: conflict.entityName,
      userEditLogs: conflict.logs,
      resolve: (confirmed: boolean, excludeFields?: string[]) => {
        resolve({ confirmed, excludeFields })
      },
    })
  })
}

export const DELETE_TOOLS = new Set([
  'delete_character', 'delete_world_setting', 'delete_item', 'delete_foreshadow',
])

export function resolveDeleteTargetInfo(toolName: string, params: Record<string, any>): { targetName: string; entityType: string } {
  const worldStore = useWorldStore.getState()
  let targetName = ''
  const entityTypeMap: Record<string, string> = {
    delete_character: 'character',
    delete_world_setting: 'world_setting',
    delete_item: 'item',
    delete_foreshadow: 'foreshadow',
  }

  if (toolName === 'delete_character') {
    const c = worldStore.characters.find(c => c.id === params.characterId)
    targetName = c?.name || params.characterId
  } else if (toolName === 'delete_world_setting') {
    const w = worldStore.worldSettings.find(w => w.id === params.settingId)
    targetName = w?.title || params.settingId
  } else if (toolName === 'delete_item') {
    const i = worldStore.items.find(i => i.id === params.itemId)
    targetName = i?.name || params.itemId
  } else if (toolName === 'delete_foreshadow') {
    const f = worldStore.foreshadows.find(f => f.id === params.foreshadowId)
    targetName = f?.title || params.foreshadowId
  }

  return { targetName, entityType: entityTypeMap[toolName] || 'unknown' }
}

function filterExcludedFields(params: Record<string, any>, excludeFields: string[]): Record<string, any> {
  const filtered = { ...params }
  for (const field of excludeFields) delete filtered[field]
  return filtered
}

export async function executeTool(
  toolName: string,
  params: Record<string, any>,
  projectId: string,
  accessScope?: AIAccessScope,
): Promise<ToolExecutionResult> {
  try {
    const validation = validateToolParams(toolName, params)
    if (!validation.success) return { success: false, result: validation.error }
    params = validation.data

    const scope = accessScope || DEFAULT_AI_ACCESS_SCOPE
    const accessError = checkAIAccess(toolName, params, scope)
    if (accessError) return { success: false, result: accessError }

    const conflict = checkUserEditConflict(toolName, params)
    if (conflict) {
      const { confirmed, excludeFields } = await requestUserConfirmation(toolName, params, conflict)
      if (!confirmed) {
        return { success: false, result: '사용자가 AI 수정을 취소했습니다.' }
      }
      if (excludeFields && excludeFields.length > 0 && conflict.entityType !== 'emotion') {
        params = filterExcludedFields(params, excludeFields)
      }
      useUserEditLogStore.getState().clearLogsForEntity(conflict.entityType, conflict.entityId)
    }

    const handler = TOOL_HANDLERS[toolName]
    if (!handler) return { success: false, result: `알 수 없는 도구: ${toolName}` }
    return await handler(params, projectId)
  } catch (err: any) {
    return { success: false, result: `오류: ${err.message}` }
  }
}
