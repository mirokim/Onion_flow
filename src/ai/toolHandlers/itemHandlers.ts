import { useWorldStore } from '@/stores/worldStore'
import { useWikiStore } from '@/stores/wikiStore'
import type { ToolExecutionResult } from '../toolExecutor'
import { upsertEntity } from './upsertEntity'

/** Build wiki content string from item params */
function buildItemWikiContent(params: Record<string, any>): string {
  const lines: string[] = []
  if (params.itemType) lines.push(`종류: ${params.itemType}`)
  if (params.rarity) lines.push(`등급: ${params.rarity}`)
  if (params.effect) lines.push(`효과: ${params.effect}`)
  if (params.description) lines.push(`설명: ${params.description}`)
  if (params.owner) lines.push(`소유자: ${params.owner}`)
  if (params.notes) lines.push(`메모: ${params.notes}`)
  return lines.join('\n')
}

export async function handleSaveItem(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { itemId, name, ...rest } = params
  const worldStore = useWorldStore.getState()

  const isNew = !itemId && !worldStore.items.find(i => i.name === name && i.projectId === projectId)

  const result = await upsertEntity({
    projectId, entityType: 'item', entityId: itemId,
    findById: (id) => worldStore.items.find(i => i.id === id),
    findByName: () => worldStore.items.find(i => i.name === name && i.projectId === projectId),
    getId: (i) => i.id, create: () => worldStore.createItem(projectId, name),
    update: (id, data) => worldStore.updateItem(id, data),
    updateData: rest, versionData: { name, ...rest }, displayName: name, entityLabel: '아이템',
  })

  // Auto-sync to wiki: create linked entry for new items
  if (result.success && isNew) {
    try {
      const wikiStore = useWikiStore.getState()
      const created = useWorldStore.getState().items.find(i => i.name === name && i.projectId === projectId)
      if (created && !wikiStore.findLinkedEntry(created.id, 'item')) {
        const content = buildItemWikiContent(rest)
        await wikiStore.createLinkedEntry(projectId, created.id, 'item', 'item', name, content)
      }
    } catch (e) {
      console.warn('[AI] Wiki sync failed for item:', e)
    }
  }

  // Auto-sync to wiki: update linked entry for existing items
  if (result.success && !isNew) {
    try {
      const wikiStore = useWikiStore.getState()
      const iid = itemId || useWorldStore.getState().items.find(i => i.name === name && i.projectId === projectId)?.id
      if (iid) {
        const linked = wikiStore.findLinkedEntry(iid, 'item')
        if (linked) {
          const content = buildItemWikiContent(rest)
          const updates: Record<string, any> = {}
          if (name) updates.title = name
          if (content) updates.content = content
          if (rest.tags) updates.tags = rest.tags
          if (Object.keys(updates).length > 0) await wikiStore.updateEntry(linked.id, updates)
        }
      }
    } catch (e) {
      console.warn('[AI] Wiki sync failed for item update:', e)
    }
  }

  return result
}

export async function handleDeleteItem(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { itemId } = params
  const worldStore = useWorldStore.getState()
  const item = worldStore.items.find(i => i.id === itemId)
  if (!item) return { success: false, result: `아이템 ID '${itemId}'을(를) 찾을 수 없습니다.` }

  // Remove linked wiki entry
  try {
    const wikiStore = useWikiStore.getState()
    const linked = wikiStore.findLinkedEntry(itemId, 'item')
    if (linked) await wikiStore.deleteEntry(linked.id)
  } catch (e) {
    console.warn('[AI] Wiki cleanup failed for item delete:', e)
  }

  await worldStore.deleteItem(itemId)
  return { success: true, result: `아이템 '${item.name}'이(가) 삭제되었습니다.` }
}
