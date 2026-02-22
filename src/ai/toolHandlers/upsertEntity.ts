import { useVersionStore } from '@/stores/versionStore'
import type { EntityType } from '@/types'
import type { ToolExecutionResult } from '../toolExecutor'

export interface UpsertConfig<T> {
  projectId: string
  entityType: EntityType
  entityId?: string
  findById: (id: string) => T | undefined
  findByName: () => T | undefined
  getId: (entity: T) => string
  create: () => Promise<T>
  update: (id: string, data: Record<string, any>) => Promise<void>
  updateData: Record<string, any>
  versionData: Record<string, any>
  displayName: string
  entityLabel: string
}

export async function upsertEntity<T>(config: UpsertConfig<T>): Promise<ToolExecutionResult> {
  const {
    projectId, entityType, entityId, findById, findByName,
    getId, create, update, updateData, versionData,
    displayName, entityLabel,
  } = config

  if (entityId) {
    const existing = findById(entityId)
    if (!existing) return { success: false, result: `${entityLabel} ID '${entityId}'을(를) 찾을 수 없습니다.` }
    await update(entityId, updateData)
    await useVersionStore.getState().createVersion({
      projectId, entityType, entityId, data: versionData, label: `${entityLabel} 수정: ${displayName}`, createdBy: 'ai',
    })
    return { success: true, result: `${entityLabel} '${displayName}'이(가) 수정되었습니다.` }
  }

  const existing = findByName()
  if (existing) {
    const existingId = getId(existing)
    await update(existingId, updateData)
    await useVersionStore.getState().createVersion({
      projectId, entityType, entityId: existingId, data: versionData, label: `${entityLabel} 수정: ${displayName}`, createdBy: 'ai',
    })
    return { success: true, result: `${entityLabel} '${displayName}'이(가) 수정되었습니다. (기존 ${entityLabel} 업데이트)` }
  }

  const created = await create()
  const createdId = getId(created)
  if (Object.keys(updateData).length > 0) await update(createdId, updateData)
  await useVersionStore.getState().createVersion({
    projectId, entityType, entityId: createdId, data: versionData, label: `${entityLabel} 생성: ${displayName}`, createdBy: 'ai',
  })
  return { success: true, result: `${entityLabel} '${displayName}'이(가) 생성되었습니다. (ID: ${createdId})` }
}
