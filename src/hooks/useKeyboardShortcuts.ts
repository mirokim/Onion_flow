/**
 * Global keyboard shortcuts hook.
 * Handles common actions like save, focus mode, panel toggles, undo/redo.
 */
import { useEffect, useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useUndoStore, type UndoContext } from '@/stores/undoStore'
import { getSQLiteAdapter } from '@/db/storageAdapter'
import type { SettingsSection } from '@/components/common/SettingsDialog'

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
    const isCtrl = e.ctrlKey || e.metaKey
    const isShift = e.shiftKey
    const target = e.target as HTMLElement

    // ── Undo: Ctrl+Z (must be checked BEFORE input/textarea guard) ──
    if (isCtrl && !isShift && e.key === 'z') {
      const ctx = getActiveUndoContext(target)
      if (ctx === 'editor' || ctx === 'native') return // Let native handler
      if (ctx === 'canvas' || ctx === 'wiki') {
        e.preventDefault()
        useUndoStore.getState().undo(ctx)
        return
      }
      return
    }

    // ── Redo: Ctrl+Y ──
    if (isCtrl && !isShift && e.key === 'y') {
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
      // Only handle Ctrl+S in editable areas
      if (isCtrl && e.key === 's') {
        e.preventDefault()
        getSQLiteAdapter().saveNow()
        handlers.onSave?.()
      }
      return
    }

    // Ctrl+S: Save
    if (isCtrl && e.key === 's') {
      e.preventDefault()
      getSQLiteAdapter().saveNow()
      handlers.onSave?.()
      return
    }

    // Ctrl+Shift+F: Focus mode
    if (isCtrl && isShift && e.key === 'F') {
      e.preventDefault()
      toggleFocusMode()
      return
    }

    // Ctrl+1: Toggle canvas tab
    if (isCtrl && e.key === '1') {
      e.preventDefault()
      toggleTab('canvas')
      return
    }

    // Ctrl+2: Toggle editor tab
    if (isCtrl && e.key === '2') {
      e.preventDefault()
      toggleTab('editor')
      return
    }

    // Ctrl+3: Toggle wiki tab
    if (isCtrl && e.key === '3') {
      e.preventDefault()
      toggleTab('wiki')
      return
    }

    // Ctrl+Shift+S: Open settings → stats tab
    if (isCtrl && isShift && e.key === 'S') {
      e.preventDefault()
      handlers.onOpenSettings?.('stats')
      return
    }

    // Ctrl+Shift+T: Open settings → timeline tab
    if (isCtrl && isShift && e.key === 'T') {
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
