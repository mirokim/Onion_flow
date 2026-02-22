/**
 * TabBar - Obsidian-style vertical sidebar for toggling & reordering panels.
 * Open tabs are draggable to reorder panel positions.
 * Closed tabs appear below a divider as inactive icons.
 */
import { useState, useRef } from 'react'
import { LayoutGrid, FileText, BookOpen } from 'lucide-react'
import { useEditorStore, type PanelTab } from '@/stores/editorStore'
import { cn } from '@/lib/utils'

const ALL_TABS: { key: PanelTab; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'canvas', label: 'Story Flow', icon: LayoutGrid },
  { key: 'editor', label: 'Editor', icon: FileText },
  { key: 'wiki', label: 'Wiki', icon: BookOpen },
]

export function TabBar() {
  const { openTabs, toggleTab, reorderTabs } = useEditorStore()
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const dragItem = useRef<PanelTab | null>(null)

  const openTabDefs = openTabs
    .map(key => ALL_TABS.find(t => t.key === key)!)
    .filter(Boolean)

  const closedTabDefs = ALL_TABS.filter(t => !openTabs.includes(t.key))

  const handleDragStart = (tab: PanelTab) => {
    dragItem.current = tab
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    setDragOverIndex(index)
  }

  const handleDragLeave = () => {
    setDragOverIndex(null)
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    setDragOverIndex(null)
    const dragged = dragItem.current
    if (!dragged) return

    const currentIndex = openTabs.indexOf(dragged)
    if (currentIndex === dropIndex) return

    const newTabs = [...openTabs]
    newTabs.splice(currentIndex, 1)
    newTabs.splice(dropIndex, 0, dragged)
    reorderTabs(newTabs)
    dragItem.current = null
  }

  const handleDragEnd = () => {
    setDragOverIndex(null)
    dragItem.current = null
  }

  return (
    <div className="flex flex-col items-center w-10 bg-bg-secondary border-r border-border py-2 shrink-0 select-none">
      {/* Open tabs (draggable) */}
      <div className="flex flex-col items-center gap-0.5 w-full px-1">
        {openTabDefs.map(({ key, label, icon: Icon }, index) => (
          <div
            key={key}
            className="relative w-full flex justify-center"
            draggable
            onDragStart={() => handleDragStart(key)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
          >
            {/* Drop indicator line */}
            {dragOverIndex === index && (
              <div className="absolute -top-[2px] left-1 right-1 h-[2px] bg-accent rounded-full" />
            )}
            <button
              onClick={() => toggleTab(key)}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded transition-all cursor-grab active:cursor-grabbing',
                'bg-accent/20 text-accent border border-accent/30',
              )}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          </div>
        ))}
        {/* Drop indicator for last position */}
        {dragOverIndex === openTabs.length && (
          <div className="w-6 h-[2px] bg-accent rounded-full" />
        )}
        {/* Drop zone after last open tab */}
        <div
          className="w-full h-2"
          onDragOver={(e) => handleDragOver(e, openTabs.length)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, openTabs.length)}
        />
      </div>

      {/* Divider between open and closed tabs */}
      {closedTabDefs.length > 0 && (
        <>
          <div className="w-5 h-px bg-border my-1" />

          {/* Closed tabs (click to open) */}
          <div className="flex flex-col items-center gap-0.5 w-full px-1">
            {closedTabDefs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => toggleTab(key)}
                className="flex items-center justify-center w-8 h-8 rounded transition-all text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-transparent"
                title={label}
              >
                <Icon className="w-4 h-4" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
