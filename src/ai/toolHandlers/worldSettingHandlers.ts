import { useWorldStore } from '@/stores/worldStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useVersionStore } from '@/stores/versionStore'
import { resolveCategory } from '../constants'
import type { ToolExecutionResult } from '../toolExecutor'
import type { WikiCategory } from '@/types'

/** Map world setting category to wiki category */
function toWikiCategory(wsCategory: string): WikiCategory {
  const map: Record<string, WikiCategory> = {
    geography: 'geography', politics: 'politics', culture: 'culture',
    history: 'history', religion: 'religion', economy: 'economy',
    language: 'language', species: 'species', society: 'society',
    magic: 'magic', technology: 'technology', disease: 'disease',
  }
  return map[wsCategory] || 'other'
}

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
    // Sync linked wiki entry
    syncWikiForWorldSetting(settingId, title, content, tags, validCategory)
    return { success: true, result: `세계관 설정 '${title}'이(가) 수정되었습니다.` }
  }

  const existing = worldStore.worldSettings.find(ws => ws.title === title && ws.projectId === projectId)
  if (existing) {
    await worldStore.updateWorldSetting(existing.id, { category: validCategory, title, content, tags })
    await useVersionStore.getState().createVersion({
      projectId, entityType: 'world_setting', entityId: existing.id,
      data: { category: validCategory, title, content, tags }, label: `세계관 수정: ${title}`, createdBy: 'ai',
    })
    syncWikiForWorldSetting(existing.id, title, content, tags, validCategory)
    return { success: true, result: `세계관 설정 '${title}'이(가) 수정되었습니다.` }
  }

  // New world setting
  const ws = await worldStore.createWorldSetting(projectId, validCategory, title)
  if (content || (tags && tags.length > 0)) {
    await worldStore.updateWorldSetting(ws.id, { content: content || '', tags: tags || [] })
  }
  await useVersionStore.getState().createVersion({
    projectId, entityType: 'world_setting', entityId: ws.id,
    data: { category: validCategory, title, content, tags }, label: `세계관 생성: ${title}`, createdBy: 'ai',
  })

  // Auto-create linked wiki entry
  try {
    const wikiStore = useWikiStore.getState()
    if (!wikiStore.findLinkedEntry(ws.id, 'world_setting')) {
      await wikiStore.createLinkedEntry(projectId, ws.id, 'world_setting', toWikiCategory(validCategory), title, content || '')
    }
  } catch (e) {
    console.warn('[AI] Wiki sync failed for world setting:', e)
  }

  return { success: true, result: `세계관 설정 '${title}'이(가) 생성되었습니다.` }
}

/** Sync existing linked wiki entry with updated world setting data */
function syncWikiForWorldSetting(entityId: string, title: string, content: string, tags: string[], category: string) {
  try {
    const wikiStore = useWikiStore.getState()
    const linked = wikiStore.findLinkedEntry(entityId, 'world_setting')
    if (linked) {
      const updates: Record<string, any> = {}
      if (title) updates.title = title
      if (content) updates.content = content
      if (tags) updates.tags = tags
      if (Object.keys(updates).length > 0) wikiStore.updateEntry(linked.id, updates)
    }
  } catch (e) {
    console.warn('[AI] Wiki sync failed for world setting update:', e)
  }
}

export async function handleDeleteWorldSetting(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { settingId } = params
  const worldStore = useWorldStore.getState()
  const ws = worldStore.worldSettings.find(w => w.id === settingId)
  if (!ws) return { success: false, result: `세계관 설정 ID '${settingId}'을(를) 찾을 수 없습니다.` }

  // Remove linked wiki entry
  try {
    const wikiStore = useWikiStore.getState()
    const linked = wikiStore.findLinkedEntry(settingId, 'world_setting')
    if (linked) await wikiStore.deleteEntry(linked.id)
  } catch (e) {
    console.warn('[AI] Wiki cleanup failed for world setting delete:', e)
  }

  await worldStore.deleteWorldSetting(settingId)
  return { success: true, result: `세계관 설정 '${ws.title}'이(가) 삭제되었습니다.` }
}
