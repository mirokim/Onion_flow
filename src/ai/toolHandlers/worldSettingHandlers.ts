import { useWorldStore } from '@/stores/worldStore'
import { useVersionStore } from '@/stores/versionStore'
import { resolveCategory } from '../constants'
import type { ToolExecutionResult } from '../toolExecutor'

export async function handleSaveWorldSetting(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { settingId, category, title, content, tags } = params
  const worldStore = useWorldStore.getState()
  const validCategory = resolveCategory(category)

  if (settingId) {
    await worldStore.updateWorldSetting(settingId, { category: validCategory, title, content, tags })
    await useVersionStore.getState().createVersion({
      projectId, entityType: 'world_setting', entityId: settingId,
      data: { category: validCategory, title, content, tags }, label: `세계관 수정: ${title}`, createdBy: 'ai',
    })
    return { success: true, result: `세계관 설정 '${title}'이(가) 수정되었습니다.` }
  }

  const existing = worldStore.worldSettings.find(ws => ws.title === title && ws.projectId === projectId)
  if (existing) {
    await worldStore.updateWorldSetting(existing.id, { category: validCategory, title, content, tags })
    await useVersionStore.getState().createVersion({
      projectId, entityType: 'world_setting', entityId: existing.id,
      data: { category: validCategory, title, content, tags }, label: `세계관 수정: ${title}`, createdBy: 'ai',
    })
    return { success: true, result: `세계관 설정 '${title}'이(가) 수정되었습니다.` }
  }

  const ws = await worldStore.createWorldSetting(projectId, validCategory, title)
  if (content || (tags && tags.length > 0)) {
    await worldStore.updateWorldSetting(ws.id, { content: content || '', tags: tags || [] })
  }
  await useVersionStore.getState().createVersion({
    projectId, entityType: 'world_setting', entityId: ws.id,
    data: { category: validCategory, title, content, tags }, label: `세계관 생성: ${title}`, createdBy: 'ai',
  })
  return { success: true, result: `세계관 설정 '${title}'이(가) 생성되었습니다.` }
}

export async function handleDeleteWorldSetting(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { settingId } = params
  const worldStore = useWorldStore.getState()
  const ws = worldStore.worldSettings.find(w => w.id === settingId)
  if (!ws) return { success: false, result: `세계관 설정 ID '${settingId}'을(를) 찾을 수 없습니다.` }
  await worldStore.deleteWorldSetting(settingId)
  return { success: true, result: `세계관 설정 '${ws.title}'이(가) 삭제되었습니다.` }
}
