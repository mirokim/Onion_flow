import { useWikiStore } from '@/stores/wikiStore'
import type { ToolExecutionResult } from '../toolExecutor'
import type { WikiCategory } from '@/types'

export async function handleCreateWikiEntry(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { category, title, content, tags } = params
  const wikiStore = useWikiStore.getState()

  const entry = await wikiStore.createEntry(projectId, category as WikiCategory, title)

  const updates: Partial<{ content: string; tags: string[] }> = {}
  if (content) updates.content = content
  if (tags) updates.tags = tags
  if (Object.keys(updates).length > 0) {
    await wikiStore.updateEntry(entry.id, updates)
  }

  return { success: true, result: `위키 항목 '${title}'이(가) 생성되었습니다. (ID: ${entry.id}, 카테고리: ${category})` }
}

export async function handleUpdateWikiEntry(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { entryId, ...updates } = params
  const wikiStore = useWikiStore.getState()
  const entry = wikiStore.entries.find(e => e.id === entryId)
  if (!entry) return { success: false, result: `위키 항목 ID '${entryId}'을(를) 찾을 수 없습니다.` }

  await wikiStore.updateEntry(entryId, updates)
  return { success: true, result: `위키 항목 '${entry.title}'이(가) 수정되었습니다.` }
}

export async function handleDeleteWikiEntry(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { entryId } = params
  const wikiStore = useWikiStore.getState()
  const entry = wikiStore.entries.find(e => e.id === entryId)
  if (!entry) return { success: false, result: `위키 항목 ID '${entryId}'을(를) 찾을 수 없습니다.` }

  await wikiStore.deleteEntry(entryId)
  return { success: true, result: `위키 항목 '${entry.title}'이(가) 삭제되었습니다.` }
}
