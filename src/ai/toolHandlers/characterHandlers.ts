import { useWorldStore } from '@/stores/worldStore'
import { useWikiStore } from '@/stores/wikiStore'
import type { ToolExecutionResult } from '../toolExecutor'
import { upsertEntity } from './upsertEntity'

/** Build wiki content string from character params */
function buildCharacterWikiContent(params: Record<string, any>): string {
  const lines: string[] = []
  if (params.role) lines.push(`역할: ${params.role}`)
  if (params.personality) lines.push(`성격: ${params.personality}`)
  if (params.appearance) lines.push(`외모: ${params.appearance}`)
  if (params.background) lines.push(`배경: ${params.background}`)
  if (params.motivation) lines.push(`동기: ${params.motivation}`)
  if (params.speechPattern) lines.push(`말투: ${params.speechPattern}`)
  if (params.abilities) lines.push(`능력: ${params.abilities}`)
  if (params.notes) lines.push(`메모: ${params.notes}`)
  return lines.join('\n')
}

export async function handleUpdateCharacter(params: Record<string, any>, projectId: string): Promise<ToolExecutionResult> {
  const { characterId, name, ...rest } = params
  const worldStore = useWorldStore.getState()

  const isNew = !characterId && !worldStore.characters.find(c => c.name === name && c.projectId === projectId)

  const result = await upsertEntity({
    projectId, entityType: 'character', entityId: characterId,
    findById: (id) => worldStore.characters.find(c => c.id === id),
    findByName: () => worldStore.characters.find(c => c.name === name && c.projectId === projectId),
    getId: (c) => c.id, create: () => worldStore.createCharacter(projectId, name),
    update: (id, data) => worldStore.updateCharacter(id, data),
    updateData: rest, versionData: { name, ...rest }, displayName: name, entityLabel: '인물',
  })

  // Auto-sync to wiki: create linked entry for new characters
  if (result.success && isNew) {
    try {
      const wikiStore = useWikiStore.getState()
      const created = useWorldStore.getState().characters.find(c => c.name === name && c.projectId === projectId)
      if (created && !wikiStore.findLinkedEntry(created.id, 'character')) {
        const content = buildCharacterWikiContent({ ...rest, role: rest.role || 'supporting' })
        await wikiStore.createLinkedEntry(projectId, created.id, 'character', 'character', name, content)
      }
    } catch (e) {
      console.warn('[AI] Wiki sync failed for character:', e)
    }
  }

  // Auto-sync to wiki: update linked entry for existing characters
  if (result.success && !isNew) {
    try {
      const wikiStore = useWikiStore.getState()
      const charId = characterId || useWorldStore.getState().characters.find(c => c.name === name && c.projectId === projectId)?.id
      if (charId) {
        const linked = wikiStore.findLinkedEntry(charId, 'character')
        if (linked) {
          const content = buildCharacterWikiContent({ ...rest, role: rest.role })
          const updates: Record<string, any> = {}
          if (name) updates.title = name
          if (content) updates.content = content
          if (rest.tags) updates.tags = rest.tags
          if (Object.keys(updates).length > 0) await wikiStore.updateEntry(linked.id, updates)
        }
      }
    } catch (e) {
      console.warn('[AI] Wiki sync failed for character update:', e)
    }
  }

  return result
}

export async function handleDeleteCharacter(params: Record<string, any>): Promise<ToolExecutionResult> {
  const { characterId } = params
  const worldStore = useWorldStore.getState()
  const char = worldStore.characters.find(c => c.id === characterId)
  if (!char) return { success: false, result: `인물 ID '${characterId}'을(를) 찾을 수 없습니다.` }

  // Also remove linked wiki entry
  try {
    const wikiStore = useWikiStore.getState()
    const linked = wikiStore.findLinkedEntry(characterId, 'character')
    if (linked) await wikiStore.deleteEntry(linked.id)
  } catch (e) {
    console.warn('[AI] Wiki cleanup failed for character delete:', e)
  }

  await worldStore.deleteCharacter(characterId)
  return { success: true, result: `인물 '${char.name}'이(가) 삭제되었습니다.` }
}
