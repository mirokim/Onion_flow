/**
 * TabBar - Obsidian-style vertical sidebar for toggling panels on/off.
 * Open tabs appear as active icons. Closed tabs appear below a divider as inactive icons.
 * Panel reordering is done by dragging each panel's header/tab bar.
 */
import { LayoutGrid, FileText, BookOpen, Library, MessageSquare } from 'lucide-react'
import { useEditorStore, type PanelTab } from '@/stores/editorStore'
import { cn } from '@/lib/utils'

const ALL_TABS: { key: PanelTab; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'canvas', label: 'Story Flow', icon: LayoutGrid },
  { key: 'editor', label: 'Editor', icon: FileText },
  { key: 'wiki', label: 'Wiki', icon: BookOpen },
  { key: 'chapters', label: 'Chapters', icon: Library },
  { key: 'ai', label: 'AI', icon: MessageSquare },
]

export function TabBar() {
  const { openTabs, toggleTab } = useEditorStore()

  const openTabDefs = ALL_TABS.filter(t => openTabs.includes(t.key))
  const closedTabDefs = ALL_TABS.filter(t => !openTabs.includes(t.key))

  return (
    <div className="flex flex-col items-center w-10 bg-bg-secondary border-r border-border py-2 shrink-0 select-none">
      {/* Open tabs (click to close) */}
      <div className="flex flex-col items-center gap-0.5 w-full px-1">
        {openTabDefs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => toggleTab(key)}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded transition-all',
              'bg-bg-hover text-text-primary border border-border',
            )}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
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
