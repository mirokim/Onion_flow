import { useProjectStore } from '@/stores/projectStore'
import { useVersionStore } from '@/stores/versionStore'
import { textToTipTapContent } from '../contentConverter'
import { getTextFromContent } from '@/lib/utils'
import { getAdapter } from '@/db/storageAdapter'
import { wasChapterQueried, markChapterQueried } from '../toolExecutor'
import type { ToolExecutionResult } from '../toolExecutor'

export async function handleSaveOutline(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { chapterId, synopsis, versionLabel } = params
  await useProjectStore.getState().updateChapter(chapterId, { synopsis })
  await useVersionStore.getState().createVersion({
    projectId, entityType: 'outline', entityId: chapterId,
    data: { synopsis }, label: versionLabel || 'AI 아웃라인 저장', createdBy: 'ai',
  })
  return { success: true, result: `아웃라인이 저장되었습니다.` }
}

export async function handleWriteChapterContent(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { chapterId, content: text, versionLabel } = params

  if (!wasChapterQueried(chapterId)) {
    return {
      success: false,
      result: '⚠️ 본문을 교체하기 전에 반드시 get_current_state(dataType: "chapter_content", entityId: "챕터ID")로 현재 본문을 먼저 조회해야 합니다.',
    }
  }

  const jsonContent = textToTipTapContent(text)
  const plainText = getTextFromContent(jsonContent)
  const wordCount = plainText.replace(/\s/g, '').length
  const oldChapter = await getAdapter().fetchChapter(chapterId)

  if (oldChapter?.content) {
    await useVersionStore.getState().createVersion({
      projectId, entityType: 'chapter', entityId: chapterId,
      data: { content: oldChapter.content, wordCount: oldChapter.wordCount },
      label: versionLabel ? `교체 전: ${versionLabel}` : '본문 교체 전 백업', createdBy: 'ai',
    })
  }

  await useProjectStore.getState().updateChapterContent(chapterId, jsonContent)
  await useProjectStore.getState().updateChapter(chapterId, { wordCount })
  return { success: true, result: `챕터 본문이 작성되었습니다. (${wordCount}자)` }
}

export async function handleAppendToChapter(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { chapterId, content: text } = params
  const chapter = await getAdapter().fetchChapter(chapterId)
  const newNodes = textToTipTapContent(text)

  const newContent = chapter?.content?.content
    ? { type: 'doc' as const, content: [...chapter.content.content, ...(newNodes.content || [])] }
    : newNodes
  const plainText = getTextFromContent(newContent)
  const wordCount = plainText.replace(/\s/g, '').length
  await useProjectStore.getState().updateChapterContent(chapterId, newContent)
  await useProjectStore.getState().updateChapter(chapterId, { wordCount })
  return { success: true, result: `내용이 추가되었습니다. (총 ${wordCount}자)` }
}

export async function handleCreateChapter(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { title, content: text, synopsis, parentId } = params
  const chapter = await useProjectStore.getState().createChapter(title, parentId || null)
  if (text) {
    const jsonContent = textToTipTapContent(text)
    const plainText = getTextFromContent(jsonContent)
    const wordCount = plainText.replace(/\s/g, '').length
    await useProjectStore.getState().updateChapterContent(chapter.id, jsonContent)
    await useProjectStore.getState().updateChapter(chapter.id, { wordCount, synopsis: synopsis || '' })
  } else if (synopsis) {
    await useProjectStore.getState().updateChapter(chapter.id, { synopsis })
  }
  return { success: true, result: `챕터 '${title}'이(가) 생성되었습니다. (ID: ${chapter.id})` }
}

export async function handleCreateVolume(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { title } = params
  const volume = await useProjectStore.getState().createChapter(title, null, 'volume')
  return { success: true, result: `권 '${title}'이(가) 생성되었습니다. (ID: ${volume.id})` }
}

export async function handleRenameChapter(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { chapterId, newTitle } = params
  await useProjectStore.getState().updateChapter(chapterId, { title: newTitle })
  return { success: true, result: `제목이 '${newTitle}'(으)로 변경되었습니다.` }
}
