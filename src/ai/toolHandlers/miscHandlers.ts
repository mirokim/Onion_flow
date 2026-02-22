import { useWorldStore } from '@/stores/worldStore'
import { useEditorStore } from '@/stores/editorStore'
import { EMOTION_TYPES, EMOTION_SCORE_MIN, EMOTION_SCORE_MAX } from '../constants'
import type { ToolExecutionResult } from '../toolExecutor'

export async function handleSaveRelation(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { relationId, sourceName, targetName, relationType, description, isBidirectional } = params
  const worldStore = useWorldStore.getState()
  const chars = worldStore.characters
  const source = chars.find(c => c.name === sourceName)
  const target = chars.find(c => c.name === targetName)
  if (!source) return { success: false, result: `인물 '${sourceName}'을(를) 찾을 수 없습니다.` }
  if (!target) return { success: false, result: `인물 '${targetName}'을(를) 찾을 수 없습니다.` }

  if (relationId) {
    await worldStore.updateRelation(relationId, { relationType, description, isBidirectional: isBidirectional ?? true })
    return { success: true, result: `관계가 수정되었습니다: ${sourceName} ↔ ${targetName} (${relationType})` }
  }

  const existing = worldStore.relations.find(r =>
    r.projectId === projectId &&
    ((r.sourceId === source.id && r.targetId === target.id) || (r.sourceId === target.id && r.targetId === source.id))
  )
  if (existing) {
    await worldStore.updateRelation(existing.id, { relationType, description, isBidirectional: isBidirectional ?? true })
    return { success: true, result: `관계가 수정되었습니다: ${sourceName} ↔ ${targetName} (${relationType})` }
  }

  await worldStore.createRelation(projectId, source.id, target.id, relationType)
  return { success: true, result: `관계가 생성되었습니다: ${sourceName} ↔ ${targetName} (${relationType})` }
}

export async function handleAnalyzeCharacterEmotions(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { characterName, chapterEmotions } = params
  const chars = useWorldStore.getState().characters
  const char = chars.find(c => c.name === characterName)
  if (!char) return { success: false, result: `캐릭터 '${characterName}'을(를) 찾을 수 없습니다.` }

  let savedCount = 0
  for (const entry of chapterEmotions) {
    const { chapterId, ...emotionScores } = entry
    const emotions: Record<string, number> = {}
    for (const key of EMOTION_TYPES) {
      emotions[key] = typeof emotionScores[key] === 'number'
        ? Math.max(EMOTION_SCORE_MIN, Math.min(EMOTION_SCORE_MAX, emotionScores[key]))
        : 0
    }
    useEditorStore.getState().setEmotionData(char.id, chapterId, emotions)
    savedCount++
  }

  return { success: true, result: `'${characterName}'의 감정 데이터가 ${savedCount}개 챕터에 저장되었습니다.` }
}

export async function handleSetEditorOption(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { option, value } = params
  const editorStore = useEditorStore.getState()

  if (option === 'show_line_numbers') {
    editorStore.setShowLineNumbers(!!value)
    return { success: true, result: `줄 번호 표시가 ${value ? '켜졌' : '꺼졌'}습니다.` }
  }
  if (option === 'line_number_brightness') {
    const opacity = Math.max(0.1, Math.min(1.0, value))
    editorStore.setLineNumberOpacity(opacity)
    if (!editorStore.showLineNumbers) editorStore.setShowLineNumbers(true)
    return { success: true, result: `줄 번호 밝기가 ${Math.round(opacity * 100)}%로 설정되었습니다.` }
  }
  return { success: false, result: `알 수 없는 옵션: ${option}` }
}
