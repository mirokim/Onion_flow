/**
 * Keyboard shortcut definitions, resolution, and matching utilities.
 * Central source of truth for all app shortcuts.
 */

export interface ShortcutDefinition {
  id: string
  labelKo: string
  labelEn: string
  category: 'general' | 'panel' | 'settings'
  defaultKeys: string  // e.g. "Ctrl+S", "Ctrl+Shift+F"
}

/** All default shortcuts in the app */
export const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  // General
  { id: 'save',           labelKo: '저장',          labelEn: 'Save',            category: 'general',  defaultKeys: 'Ctrl+S' },
  { id: 'undo',           labelKo: '실행취소',      labelEn: 'Undo',            category: 'general',  defaultKeys: 'Ctrl+Z' },
  { id: 'redo',           labelKo: '다시실행',      labelEn: 'Redo',            category: 'general',  defaultKeys: 'Ctrl+Y' },
  { id: 'focusMode',      labelKo: '집중 모드',     labelEn: 'Focus Mode',      category: 'general',  defaultKeys: 'Ctrl+Shift+F' },
  // Panel toggles
  { id: 'toggleCanvas',   labelKo: '캔버스 토글',   labelEn: 'Toggle Canvas',   category: 'panel',    defaultKeys: 'Ctrl+1' },
  { id: 'toggleEditor',   labelKo: '에디터 토글',   labelEn: 'Toggle Editor',   category: 'panel',    defaultKeys: 'Ctrl+2' },
  { id: 'toggleWiki',     labelKo: '위키 토글',     labelEn: 'Toggle Wiki',     category: 'panel',    defaultKeys: 'Ctrl+3' },
  // Settings
  { id: 'openStats',      labelKo: '통계 열기',     labelEn: 'Open Stats',      category: 'settings', defaultKeys: 'Ctrl+Shift+S' },
  { id: 'openTimeline',   labelKo: '타임라인 열기', labelEn: 'Open Timeline',   category: 'settings', defaultKeys: 'Ctrl+Shift+T' },
]

/**
 * Resolve the effective keybinding for a shortcut ID.
 * Returns the custom override if set, otherwise the default.
 */
export function resolveKeybinding(
  id: string,
  customKeybindings: Record<string, string>,
): string {
  if (customKeybindings[id]) return customKeybindings[id]
  const def = DEFAULT_SHORTCUTS.find(s => s.id === id)
  return def?.defaultKeys ?? ''
}

/**
 * Parse a key combo string like "Ctrl+Shift+F" into its parts.
 */
function parseKeyCombo(combo: string): { ctrl: boolean; shift: boolean; alt: boolean; meta: boolean; key: string } {
  const parts = combo.split('+').map(p => p.trim())
  const modifiers = { ctrl: false, shift: false, alt: false, meta: false }
  let key = ''

  for (const part of parts) {
    const lower = part.toLowerCase()
    if (lower === 'ctrl' || lower === 'control') modifiers.ctrl = true
    else if (lower === 'shift') modifiers.shift = true
    else if (lower === 'alt') modifiers.alt = true
    else if (lower === 'meta' || lower === 'cmd') modifiers.meta = true
    else key = lower
  }

  return { ...modifiers, key }
}

/**
 * Check if a KeyboardEvent matches a key combo string.
 * "Ctrl" matches both ctrlKey and metaKey (for Mac compatibility).
 */
export function matchesKeybinding(e: KeyboardEvent, keyCombo: string): boolean {
  const parsed = parseKeyCombo(keyCombo)
  const isCtrl = e.ctrlKey || e.metaKey

  // Match modifier state
  if (parsed.ctrl && !isCtrl) return false
  if (!parsed.ctrl && isCtrl) return false
  if (parsed.shift !== e.shiftKey) return false
  if (parsed.alt !== e.altKey) return false

  // Match the key itself
  const eventKey = e.key.toLowerCase()
  // Handle number keys (e.g. '1', '2', '3')
  if (parsed.key === eventKey) return true
  // Handle letter keys case-insensitively
  if (parsed.key.length === 1 && eventKey.length === 1 && parsed.key === eventKey) return true

  return false
}

/**
 * Convert a KeyboardEvent into a normalized key combo string.
 * Used for the "record shortcut" UI.
 */
export function eventToKeyCombo(e: KeyboardEvent): string | null {
  // Ignore bare modifier keys
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null

  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('Ctrl')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  // Normalize key display
  let key = e.key
  if (key === ' ') key = 'Space'
  else if (key.length === 1) key = key.toUpperCase()

  parts.push(key)
  return parts.join('+')
}

/**
 * Format a key combo string for display (e.g. nice badge rendering).
 * Returns an array of individual key parts for rendering as separate badges.
 */
export function formatKeyComboForDisplay(combo: string): string[] {
  return combo.split('+').map(p => p.trim())
}

/**
 * Category labels for grouping shortcuts in the settings UI.
 */
export const SHORTCUT_CATEGORIES: { key: string; labelKo: string; labelEn: string }[] = [
  { key: 'general',  labelKo: '일반',   labelEn: 'General' },
  { key: 'panel',    labelKo: '패널',   labelEn: 'Panels' },
  { key: 'settings', labelKo: '설정',   labelEn: 'Settings' },
]
