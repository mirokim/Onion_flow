import { useWorldStore } from '@/stores/worldStore'
import type { ToolExecutionResult } from '../toolExecutor'
import { upsertEntity } from './upsertEntity'

export async function handleSaveItem(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { itemId, name, ...rest } = params
  const worldStore = useWorldStore.getState()
  return upsertEntity({
    projectId, entityType: 'item', entityId: itemId,
    findById: (id) => worldStore.items.find(i => i.id === id),
    findByName: () => worldStore.items.find(i => i.name === name && i.projectId === projectId),
    getId: (i) => i.id, create: () => worldStore.createItem(projectId, name),
    update: (id, data) => worldStore.updateItem(id, data),
    updateData: rest, versionData: { name, ...rest }, displayName: name, entityLabel: '아이템',
  })
}

export async function handleDeleteItem(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { itemId } = params
  const worldStore = useWorldStore.getState()
  const item = worldStore.items.find(i => i.id === itemId)
  if (!item) return { success: false, result: `아이템 ID '${itemId}'을(를) 찾을 수 없습니다.` }
  await worldStore.deleteItem(itemId)
  return { success: true, result: `아이템 '${item.name}'이(가) 삭제되었습니다.` }
}
