import { useProjectStore } from '@/stores/projectStore'
import { useWorldStore } from '@/stores/worldStore'
import { useVersionStore } from '@/stores/versionStore'
import { tipTapToText } from '../contentConverter'
import { getAdapter } from '@/db/storageAdapter'
import { markChapterQueried } from '../toolExecutor'
import type { EntityType } from '@/types'
import type { ToolExecutionResult } from '../toolExecutor'

export async function handleGetCurrentState(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { dataType, entityId } = params

  switch (dataType) {
    case 'characters': {
      const chars = useWorldStore.getState().characters
      if (entityId) {
        const c = chars.find(ch => ch.id === entityId)
        return { success: true, result: c ? JSON.stringify(c, null, 2) : '인물을 찾을 수 없습니다.' }
      }
      return { success: true, result: JSON.stringify(chars.map(c => ({ id: c.id, name: c.name, role: c.role, personality: c.personality })), null, 2) }
    }
    case 'world_settings': {
      const ws = useWorldStore.getState().worldSettings
      return { success: true, result: JSON.stringify(ws.map(w => ({ id: w.id, category: w.category, title: w.title, content: w.content.slice(0, 200) })), null, 2) }
    }
    case 'items': {
      const items = useWorldStore.getState().items
      return { success: true, result: JSON.stringify(items.map(i => ({ id: i.id, name: i.name, itemType: i.itemType, rarity: i.rarity, effect: i.effect, owner: i.owner })), null, 2) }
    }
    case 'outline': {
      const projectStore = useProjectStore.getState()
      const pid = projectStore.currentProject?.id
      const chapters = pid ? await getAdapter().fetchChapters(pid) : projectStore.chapters
      const chapterList = chapters.filter(c => c.type === 'chapter')
      return { success: true, result: JSON.stringify(chapterList.map(c => ({ id: c.id, title: c.title, synopsis: c.synopsis })), null, 2) }
    }
    case 'foreshadows': {
      return { success: true, result: JSON.stringify(useWorldStore.getState().foreshadows, null, 2) }
    }
    case 'relations': {
      const rels = useWorldStore.getState().relations
      const chars = useWorldStore.getState().characters
      return { success: true, result: JSON.stringify(rels.map(r => ({ id: r.id, source: chars.find(c => c.id === r.sourceId)?.name, target: chars.find(c => c.id === r.targetId)?.name, type: r.relationType, description: r.description })), null, 2) }
    }
    case 'chapter_content': {
      if (!entityId) return { success: false, result: 'entityId가 필요합니다.' }
      const ch = await getAdapter().fetchChapter(entityId)
      if (!ch) return { success: false, result: '챕터를 찾을 수 없습니다.' }
      markChapterQueried(entityId)
      const text = tipTapToText(ch.content)
      return { success: true, result: text || '(빈 챕터)' }
    }
    default:
      return { success: false, result: `알 수 없는 데이터 타입: ${dataType}` }
  }
}

export async function handleCreateVersionSnapshot(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { entityType, entityId, label } = params
  let data: any = null

  if (entityType === 'chapter' || entityType === 'outline') {
    const chapter = await getAdapter().fetchChapter(entityId)
    data = entityType === 'outline' ? { synopsis: chapter?.synopsis } : { content: chapter?.content, synopsis: chapter?.synopsis }
  } else if (entityType === 'character') {
    data = useWorldStore.getState().characters.find(c => c.id === entityId)
  } else if (entityType === 'world_setting') {
    data = useWorldStore.getState().worldSettings.find(w => w.id === entityId)
  } else if (entityType === 'foreshadow') {
    data = useWorldStore.getState().foreshadows.find(f => f.id === entityId)
  }

  if (!data) return { success: false, result: `엔티티를 찾을 수 없습니다.` }
  const version = await useVersionStore.getState().createVersion({
    projectId, entityType: entityType as EntityType, entityId, data, label, createdBy: 'ai',
  })
  return { success: true, result: `버전 ${version.versionNumber}으로 저장되었습니다. (${label})` }
}
