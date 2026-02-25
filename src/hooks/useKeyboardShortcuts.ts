/**
 * Global keyboard shortcuts hook.
 * Handles common actions like save, focus mode, panel toggles, undo/redo.
 * Reads custom keybindings from editorStore for configurable shortcuts.
 */
import { useEffect, useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useUndoStore, type UndoContext } from '@/stores/undoStore'
import { getSQLiteAdapter } from '@/db/storageAdapter'
import type { SettingsSection } from '@/components/common/SettingsDialog'
import { resolveKeybinding, matchesKeybinding } from '@/lib/shortcuts'

interface ShortcutHandlers {
  onSave?: () => void
  onOpenSettings?: (section?: SettingsSection) => void
}

/**
 * Detect which undo context is active based on the focused DOM element.
 * Returns 'editor' for TipTap (native undo), 'native' for INPUT/TEXTAREA,
 * 'canvas'/'wiki' for our custom undo, or null for unknown.
 */
function getActiveUndoContext(target: HTMLElement): UndoContext | 'editor' | 'native' | null {
  // 1. TipTap editor → let TipTap's History handle it
  if (target.closest('.tiptap') || target.closest('.ProseMirror')) {
    return 'editor'
  }

  // 2. Native INPUT/TEXTAREA → let browser handle it
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return 'native'
  }

  // 3. Detect panel from data-panel attribute
  const panel = target.closest('[data-panel]')
  if (panel) {
    const panelName = panel.getAttribute('data-panel')
    if (panelName === 'canvas') return 'canvas'
    if (panelName === 'wiki') return 'wiki'
  }

  // 4. Fallback: check which panels are open
  const openTabs = useEditorStore.getState().openTabs
  if (openTabs.includes('canvas')) return 'canvas'
  if (openTabs.includes('wiki')) return 'wiki'

  return null
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const { toggleFocusMode, toggleTab } = useEditorStore()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement

    // Read custom keybindings at event time (avoids extra hook + always latest)
    const customKeybindings = useEditorStore.getState().customKeybindings
    // Helper to resolve a shortcut's effective keybinding
    const kb = (id: string) => resolveKeybinding(id, customKeybindings)

    // ── Undo: must be checked BEFORE input/textarea guard ──
    if (matchesKeybinding(e, kb('undo')) && !e.shiftKey) {
      const ctx = getActiveUndoContext(target)
      if (ctx === 'editor' || ctx === 'native') return // Let native handler
      if (ctx === 'canvas' || ctx === 'wiki') {
        e.preventDefault()
        useUndoStore.getState().undo(ctx)
        return
      }
      return
    }

    // ── Redo ──
    if (matchesKeybinding(e, kb('redo')) && !e.shiftKey) {
      const ctx = getActiveUndoContext(target)
      if (ctx === 'editor' || ctx === 'native') return
      if (ctx === 'canvas' || ctx === 'wiki') {
        e.preventDefault()
        useUndoStore.getState().redo(ctx)
        return
      }
      return
    }

    // Skip if in input/textarea/contentEditable (for all other shortcuts)
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      // Only handle Save in editable areas
      if (matchesKeybinding(e, kb('save'))) {
        e.preventDefault()
        getSQLiteAdapter().saveNow()
        handlers.onSave?.()
      }
      return
    }

    // Save
    if (matchesKeybinding(e, kb('save'))) {
      e.preventDefault()
      getSQLiteAdapter().saveNow()
      handlers.onSave?.()
      return
    }

    // Focus mode
    if (matchesKeybinding(e, kb('focusMode'))) {
      e.preventDefault()
      toggleFocusMode()
      return
    }

    // Panel toggles
    if (matchesKeybinding(e, kb('toggleCanvas'))) {
      e.preventDefault()
      toggleTab('canvas')
      return
    }

    if (matchesKeybinding(e, kb('toggleEditor'))) {
      e.preventDefault()
      toggleTab('editor')
      return
    }

    if (matchesKeybinding(e, kb('toggleWiki'))) {
      e.preventDefault()
      toggleTab('wiki')
      return
    }

    // Settings shortcuts
    if (matchesKeybinding(e, kb('openStats'))) {
      e.preventDefault()
      handlers.onOpenSettings?.('stats')
      return
    }

    if (matchesKeybinding(e, kb('openTimeline'))) {
      e.preventDefault()
      handlers.onOpenSettings?.('timeline')
      return
    }
  }, [toggleFocusMode, toggleTab, handlers])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
