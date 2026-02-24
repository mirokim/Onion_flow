import { useMemo, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWikiStore } from '@/stores/wikiStore'
import { useProjectStore } from '@/stores/projectStore'
import { createEntryWithUndo } from '@/stores/undoWikiActions'
import type { WikiCategory } from '@/types'
import { PanelTabBar, type PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { useEditorStore } from '@/stores/editorStore'
import { WikiSearch } from './WikiSearch'
import { WikiCategoryList, WIKI_CATEGORY_GROUPS, WIKI_CATEGORIES } from './WikiCategoryList'
import { WikiTableView } from './WikiTableView'
import { WikiEntryEditor } from './WikiEntryEditor'
import { cn } from '@/lib/utils'
import { createPortal } from 'react-dom'

interface WikiPanelProps {
  panelDragHandlers?: PanelDragHandlers
  isGrouped?: boolean
}

export function WikiPanel({ panelDragHandlers, isGrouped }: WikiPanelProps) {
  const { t } = useTranslation()
  const { currentProject } = useProjectStore()
  const {
    entries,
    selectedEntryId,
    filterCategory,
    selectEntry,
    createEntry,
    getFilteredEntries,
  } = useWikiStore()
  const toggleTab = useEditorStore(s => s.toggleTab)
  const pinnedPanels = useEditorStore(s => s.pinnedPanels)
  const togglePanelPin = useEditorStore(s => s.togglePanelPin)
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const addBtnRef = useRef<HTMLButtonElement>(null)

  const filteredEntries = useMemo(() => getFilteredEntries(), [entries, filterCategory, useWikiStore.getState().searchQuery])

  const entryCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const e of entries) {
      counts[e.category] = (counts[e.category] ?? 0) + 1
    }
    return counts
  }, [entries])

  const selectedEntry = selectedEntryId
    ? entries.find(e => e.id === selectedEntryId)
    : null

  const handleAddEntry = async (category: WikiCategory) => {
    if (!currentProject) return
    const entry = await createEntryWithUndo(currentProject.id, category, '')
    selectEntry(entry.id)
    setShowCategoryPicker(false)
  }

  if (selectedEntry) {
    return (
      <WikiEntryEditor
        entry={selectedEntry}
        onBack={() => selectEntry(null)}
        panelDragHandlers={panelDragHandlers}
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header — PanelTabBar (hidden when grouped) */}
      {!isGrouped && (
        <PanelTabBar
          tabs={[{ id: 'wiki', label: t('wiki.title'), isPinned: pinnedPanels.includes('wiki') }]}
          activeTabId="wiki"
          onSelect={() => {}}
          onClose={() => toggleTab('wiki')}
          onTogglePin={() => togglePanelPin('wiki')}
          panelDragHandlers={panelDragHandlers}
          panelType="wiki"
          onDuplicateTab={() => useEditorStore.getState().splitTabToNewGroup('wiki')}
          actions={
            <>
              <button
                ref={addBtnRef}
                onClick={() => setShowCategoryPicker(!showCategoryPicker)}
                className="p-1 rounded hover:bg-bg-hover text-text-secondary"
                title={t('common.add')}
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
              {showCategoryPicker && (
                <CategoryPicker
                  anchorRef={addBtnRef}
                  onSelect={handleAddEntry}
                  onClose={() => setShowCategoryPicker(false)}
                />
              )}
            </>
          }
        />
      )}

      {/* Search + add button (inline when grouped) */}
      <div className="flex items-center gap-1 px-3 py-2">
        <div className="flex-1">
          <WikiSearch />
        </div>
        {isGrouped && (
          <>
            <button
              ref={addBtnRef}
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              className="shrink-0 p-1 rounded hover:bg-bg-hover text-text-secondary"
              title={t('common.add')}
            >
              <Plus className="w-4 h-4" />
            </button>
            {showCategoryPicker && (
              <CategoryPicker
                anchorRef={addBtnRef}
                onSelect={handleAddEntry}
                onClose={() => setShowCategoryPicker(false)}
              />
            )}
          </>
        )}
      </div>

      {/* Categories */}
      <div className="px-2 pb-2 border-b border-border">
        <WikiCategoryList entryCounts={entryCounts} />
      </div>

      {/* Entry table */}
      <WikiTableView
        entries={filteredEntries}
        onSelect={(id) => selectEntry(id)}
      />
    </div>
  )
}

function CategoryPicker({ anchorRef, onSelect, onClose }: {
  anchorRef: React.RefObject<HTMLButtonElement | null>
  onSelect: (category: WikiCategory) => void
  onClose: () => void
}) {
  // Load recent categories from localStorage
  const [recentCategories] = useState<WikiCategory[]>(() => {
    try {
      const stored = localStorage.getItem('wiki_recent_categories')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })

  const handleSelect = (category: WikiCategory) => {
    // Update recent categories in localStorage
    try {
      const recent = JSON.parse(localStorage.getItem('wiki_recent_categories') || '[]') as WikiCategory[]
      const updated = [category, ...recent.filter(c => c !== category)].slice(0, 5)
      localStorage.setItem('wiki_recent_categories', JSON.stringify(updated))
    } catch { /* ignore */ }
    onSelect(category)
  }

  const rect = anchorRef.current?.getBoundingClientRect()
  const top = rect ? rect.bottom + 4 : 0
  const right = rect ? window.innerWidth - rect.right : 0

  return createPortal(
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed z-50 w-48 bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden" style={{ top, right }}>
        <div className="max-h-[576px] overflow-y-auto py-1">
          {/* Recent categories */}
          {recentCategories.length > 0 && (
            <>
              <div className="px-3 pt-1.5 pb-1 text-[10px] font-medium text-text-muted uppercase tracking-wide">
                최근 사용
              </div>
              {recentCategories.map(catKey => {
                const catItem = WIKI_CATEGORIES.find(c => c.key === catKey)
                if (!catItem) return null
                return (
                  <button
                    key={`recent-${catKey}`}
                    onClick={() => handleSelect(catKey)}
                    className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
                  >
                    {catItem.icon}
                    <span>{catItem.labelKo}</span>
                  </button>
                )
              })}
              <div className="mx-2 my-1 border-t border-border" />
            </>
          )}

          {/* Grouped categories */}
          {WIKI_CATEGORY_GROUPS.map(group => (
            <div key={group.id}>
              <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-medium text-text-muted uppercase tracking-wide">
                {group.icon}
                <span>{group.labelKo}</span>
              </div>
              {group.categories.map(cat => (
                <button
                  key={cat.key}
                  onClick={() => handleSelect(cat.key)}
                  className="w-full flex items-center gap-2 text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
                >
                  {cat.icon}
                  <span>{cat.labelKo}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>,
    document.body,
  )
}
