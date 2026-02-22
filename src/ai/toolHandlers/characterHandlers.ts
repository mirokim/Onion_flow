import { useWorldStore } from '@/stores/worldStore'
import type { ToolExecutionResult } from '../toolExecutor'
import { upsertEntity } from './upsertEntity'

export async function handleUpdateCharacter(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { characterId, name, ...rest } = params
  const worldStore = useWorldStore.getState()
  return upsertEntity({
    projectId, entityType: 'character', entityId: characterId,
    findById: (id) => worldStore.characters.find(c => c.id === id),
    findByName: () => worldStore.characters.find(c => c.name === name && c.projectId === projectId),
    getId: (c) => c.id, create: () => worldStore.createCharacter(projectId, name),
    update: (id, data) => worldStore.updateCharacter(id, data),
    updateData: rest, versionData: { name, ...rest }, displayName: name, entityLabel: '인물',
  })
}

export async function handleDeleteCharacter(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { characterId } = params
  const worldStore = useWorldStore.getState()
  const char = worldStore.characters.find(c => c.id === characterId)
  if (!char) return { success: false, result: `인물 ID '${characterId}'을(를) 찾을 수 없습니다.` }
  await worldStore.deleteCharacter(characterId)
  return { success: true, result: `인물 '${char.name}'이(가) 삭제되었습니다.` }
}
