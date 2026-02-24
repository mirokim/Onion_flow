/**
 * MultiTabEditor — Obsidian-style multi-tab wrapper around BlockEditor.
 * Shows a tab bar at the top. Each tab represents an open chapter.
 */
import { useEffect } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { PanelTabBar, type PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { BlockEditor } from './BlockEditor'

interface MultiTabEditorProps {
  panelDragHandlers?: PanelDragHandlers
  isGrouped?: boolean
}

export function MultiTabEditor({ panelDragHandlers, isGrouped }: MultiTabEditorProps) {
  const editorTabs = useEditorStore(s => s.editorTabs)
  const activeEditorTabId = useEditorStore(s => s.activeEditorTabId)
  const openEditorTab = useEditorStore(s => s.openEditorTab)
  const closeEditorTab = useEditorStore(s => s.closeEditorTab)
  const setActiveEditorTab = useEditorStore(s => s.setActiveEditorTab)
  const reorderEditorTabs = useEditorStore(s => s.reorderEditorTabs)
  const toggleEditorTabPin = useEditorStore(s => s.toggleEditorTabPin)

  const currentChapter = useProjectStore(s => s.currentChapter)
  const selectChapter = useProjectStore(s => s.selectChapter)
  const chapters = useProjectStore(s => s.chapters)

  // Auto-open a tab when a chapter is selected externally
  useEffect(() => {
    if (!currentChapter) return
    const existing = editorTabs.find(t => t.targetId === currentChapter.id)
    if (!existing) {
      openEditorTab(currentChapter.id, currentChapter.title)
    } else if (existing.id !== activeEditorTabId) {
      setActiveEditorTab(existing.id)
    }
  }, [currentChapter?.id])

  // When active tab changes, sync to projectStore
  useEffect(() => {
    if (!activeEditorTabId) return
    const tab = editorTabs.find(t => t.id === activeEditorTabId)
    if (tab && tab.targetId !== currentChapter?.id) {
      selectChapter(tab.targetId)
    }
  }, [activeEditorTabId])

  // Update tab labels when chapter titles change
  useEffect(() => {
    const updatedTabs = editorTabs.map(tab => {
      const ch = chapters.find(c => c.id === tab.targetId)
      if (ch && ch.title !== tab.label) {
        return { ...tab, label: ch.title }
      }
      return tab
    })
    const changed = updatedTabs.some((t, i) => t.label !== editorTabs[i].label)
    if (changed) {
      useEditorStore.setState({ editorTabs: updatedTabs })
    }
  }, [chapters])

  const createChapter = useProjectStore(s => s.createChapter)
  const currentProject = useProjectStore(s => s.currentProject)

  const handleAddTab = async () => {
    // Open the first chapter that's not already open
    const openIds = new Set(editorTabs.map(t => t.targetId))
    const available = chapters.filter(c => c.type === 'chapter' && !openIds.has(c.id))
    if (available.length > 0) {
      openEditorTab(available[0].id, available[0].title)
      selectChapter(available[0].id)
    } else if (currentProject) {
      // All chapters open or none exist → create a new chapter
      const ch = await createChapter(`챕터 ${chapters.length + 1}`)
      selectChapter(ch.id)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {!isGrouped && (
        <PanelTabBar
          tabs={editorTabs}
          activeTabId={activeEditorTabId}
          onSelect={(tabId) => {
            setActiveEditorTab(tabId)
            const tab = editorTabs.find(t => t.id === tabId)
            if (tab) selectChapter(tab.targetId)
          }}
          onClose={closeEditorTab}
          onAdd={currentProject ? handleAddTab : undefined}
          onReorder={reorderEditorTabs}
          onTogglePin={toggleEditorTabPin}
          panelDragHandlers={panelDragHandlers}
          panelType="editor"
          onRenameTab={(tabId) => {
            const tab = editorTabs.find(t => t.id === tabId)
            if (tab) {
              const newLabel = prompt('탭 이름변경', tab.label)
              if (newLabel && newLabel.trim()) {
                useEditorStore.setState(s => ({
                  editorTabs: s.editorTabs.map(t => t.id === tabId ? { ...t, label: newLabel.trim() } : t),
                }))
              }
            }
          }}
          onDuplicateTab={() => {
            useEditorStore.getState().splitTabToNewGroup('editor')
          }}
        />
      )}
      <div className="flex-1 overflow-hidden">
        <BlockEditor />
      </div>
    </div>
  )
}
