import { useWorldStore } from '@/stores/worldStore'
import type { ToolExecutionResult } from '../toolExecutor'
import { upsertEntity } from './upsertEntity'

export async function handleSaveForeshadow(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { foreshadowId, title, ...rest } = params
  const worldStore = useWorldStore.getState()
  return upsertEntity({
    projectId, entityType: 'foreshadow', entityId: foreshadowId,
    findById: (id) => worldStore.foreshadows.find(f => f.id === id),
    findByName: () => worldStore.foreshadows.find(f => f.title === title && f.projectId === projectId),
    getId: (f) => f.id, create: () => worldStore.createForeshadow(projectId, title),
    update: (id, data) => worldStore.updateForeshadow(id, data),
    updateData: rest, versionData: { title, ...rest }, displayName: title, entityLabel: '복선',
  })
}

export async function handleDeleteForeshadow(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { foreshadowId } = params
  const worldStore = useWorldStore.getState()
  const fs = worldStore.foreshadows.find(f => f.id === foreshadowId)
  if (!fs) return { success: false, result: `복선 ID '${foreshadowId}'을(를) 찾을 수 없습니다.` }
  await worldStore.deleteForeshadow(foreshadowId)
  return { success: true, result: `복선 '${fs.title}'이(가) 삭제되었습니다.` }
}
