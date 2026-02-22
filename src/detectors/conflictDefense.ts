/**
 * Conflict Defense Detector
 * Compares text content against wiki/world settings for inconsistencies.
 */
import { useWorldStore } from '@/stores/worldStore'
import { useWikiStore } from '@/stores/wikiStore'

export interface SettingConflict {
  type: 'character' | 'world_setting' | 'wiki'
  entityName: string
  conflictDescription: string
  textExcerpt: string
  position: number
  severity: 'warning' | 'error'
}

/**
 * Check character consistency: name mentions vs. settings.
 */
function checkCharacterConflicts(text: string): SettingConflict[] {
  const conflicts: SettingConflict[] = []
  const characters = useWorldStore.getState().characters

  for (const char of characters) {
    if (!text.includes(char.name)) continue

    // Check aliases - if an alias appears but not the main name, it's not a conflict
    // Check for appearance/ability contradictions (simple keyword check)
    if (char.appearance) {
      const hairColors = ['검은', '금발', '은발', '빨간', '파란', '하얀', '갈색']
      for (const color of hairColors) {
        if (char.appearance.includes(color) && text.includes(char.name)) {
          // Check if text mentions a different hair color for this character
          const charContext = getCharacterContext(text, char.name)
          for (const otherColor of hairColors) {
            if (otherColor !== color && charContext.includes(otherColor + ' 머리')) {
              conflicts.push({
                type: 'character',
                entityName: char.name,
                conflictDescription: `외모 설정(${color})과 본문(${otherColor})이 다름`,
                textExcerpt: charContext.slice(0, 100),
                position: text.indexOf(char.name),
                severity: 'warning',
              })
            }
          }
        }
      }
    }
  }

  return conflicts
}

/**
 * Extract text context around a character name mention.
 */
function getCharacterContext(text: string, name: string): string {
  const idx = text.indexOf(name)
  if (idx < 0) return ''
  const start = Math.max(0, idx - 100)
  const end = Math.min(text.length, idx + name.length + 100)
  return text.slice(start, end)
}

/**
 * Check world setting consistency.
 */
function checkWorldSettingConflicts(text: string): SettingConflict[] {
  const conflicts: SettingConflict[] = []
  const settings = useWorldStore.getState().worldSettings

  for (const ws of settings) {
    if (!ws.title || !ws.content) continue
    // Check if setting title is mentioned in text
    if (!text.includes(ws.title)) continue

    // Simple: check if key facts from content appear correctly
    // This is a placeholder for more sophisticated NLP-based checking
    const settingContext = getCharacterContext(text, ws.title)
    if (settingContext.length > 0) {
      // Record mention for analysis (no auto-conflict detection without AI)
    }
  }

  return conflicts
}

/**
 * Run all conflict detection checks.
 */
export function detectConflicts(text: string): SettingConflict[] {
  return [
    ...checkCharacterConflicts(text),
    ...checkWorldSettingConflicts(text),
  ]
}
