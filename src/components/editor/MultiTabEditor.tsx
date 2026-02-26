/**
 * MultiTabEditor — Obsidian-style multi-tab wrapper around BlockEditor.
 * Shows a tab bar at the top. Each tab represents an open chapter or wiki entry.
 * When the active tab is a wiki tab, renders WikiEntryEditor instead of BlockEditor.
 */
import { useEffect } from 'react'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useWikiStore } from '@/stores/wikiStore'
import { PanelTabBar, type PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { BlockEditor } from './BlockEditor'
import { WikiEntryEditor } from '@/components/wiki/WikiEntryEditor'

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

  // Wiki tab support
  const wikiEntries = useWikiStore(s => s.entries)
  const activeTab = editorTabs.find(t => t.id === activeEditorTabId)
  const isWikiTab = activeTab?.type === 'wiki'
  const activeWikiEntry = isWikiTab ? wikiEntries.find(e => e.id === activeTab!.targetId) : null

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

  // When active chapter tab changes, sync to projectStore (wiki tabs are not chapters)
  useEffect(() => {
    if (!activeEditorTabId) return
    const tab = editorTabs.find(t => t.id === activeEditorTabId)
    if (tab?.type === 'chapter' && tab.targetId !== currentChapter?.id) {
      selectChapter(tab.targetId)
    }
  }, [activeEditorTabId])

  // Update tab labels when chapter titles change
  useEffect(() => {
    const updatedTabs = editorTabs.map(tab => {
      if (tab.type !== 'chapter') return tab
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

  // Update wiki tab labels when entry titles change
  useEffect(() => {
    const entryMap = new Map(wikiEntries.map(e => [e.id, e]))
    const updatedTabs = editorTabs.map(tab => {
      if (tab.type !== 'wiki') return tab
      const entry = entryMap.get(tab.targetId)
      if (entry && entry.title && entry.title !== tab.label) {
        return { ...tab, label: entry.title }
      }
      return tab
    })
    const changed = updatedTabs.some((t, i) => t.label !== editorTabs[i].label)
    if (changed) {
      useEditorStore.setState({ editorTabs: updatedTabs })
    }
  }, [wikiEntries])

  // Auto-close wiki tabs when their entry is deleted
  useEffect(() => {
    const entryIds = new Set(wikiEntries.map(e => e.id))
    const orphanedTabs = editorTabs.filter(t => t.type === 'wiki' && !entryIds.has(t.targetId))
    for (const tab of orphanedTabs) {
      closeEditorTab(tab.id)
    }
  }, [wikiEntries.length])

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
            // Only sync chapter selection (not wiki tabs)
            if (tab?.type === 'chapter') selectChapter(tab.targetId)
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
        {isWikiTab ? (
          activeWikiEntry
            ? (
              <WikiEntryEditor
                entry={activeWikiEntry}
                onBack={() => activeTab && closeEditorTab(activeTab.id)}
                panelDragHandlers={isGrouped ? panelDragHandlers : undefined}
              />
            )
            : (
              <div className="flex items-center justify-center h-full text-text-muted text-sm">
                위키 항목을 찾을 수 없습니다
              </div>
            )
        ) : (
          <BlockEditor />
        )}
      </div>
    </div>
  )
}
