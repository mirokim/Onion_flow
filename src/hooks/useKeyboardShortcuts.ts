/**
 * Global keyboard shortcuts hook.
 * Handles common actions like save, focus mode, panel toggles.
 */
import { useEffect, useCallback } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { getSQLiteAdapter } from '@/db/storageAdapter'

interface ShortcutHandlers {
  onSave?: () => void
  onToggleStats?: () => void
  onToggleTimeline?: () => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers = {}) {
  const { toggleFocusMode, toggleTab } = useEditorStore()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isCtrl = e.ctrlKey || e.metaKey
    const isShift = e.shiftKey

    // Skip if in input/textarea
    const target = e.target as HTMLElement
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

    // Ctrl+Shift+S: Stats popup
    if (isCtrl && isShift && e.key === 'S') {
      e.preventDefault()
      handlers.onToggleStats?.()
      return
    }

    // Ctrl+Shift+T: Timeline panel
    if (isCtrl && isShift && e.key === 'T') {
      e.preventDefault()
      handlers.onToggleTimeline?.()
      return
    }
  }, [toggleFocusMode, toggleTab, handlers])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
