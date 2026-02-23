import { useMemo, useState } from 'react'
import { Plus, BookOpen, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWikiStore } from '@/stores/wikiStore'
import { useProjectStore } from '@/stores/projectStore'
import type { WikiCategory } from '@/types'
import { PanelTabBar, type PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { useEditorStore } from '@/stores/editorStore'
import { WikiSearch } from './WikiSearch'
import { WikiCategoryList, WIKI_CATEGORY_GROUPS, WIKI_CATEGORIES } from './WikiCategoryList'
import { WikiEntryEditor } from './WikiEntryEditor'
import { cn } from '@/lib/utils'

interface WikiPanelProps {
  panelDragHandlers?: PanelDragHandlers
}

export function WikiPanel({ panelDragHandlers }: WikiPanelProps) {
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
    const entry = await createEntry(currentProject.id, category, '')
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
      {/* Header — PanelTabBar for consistency */}
      <PanelTabBar
        tabs={[{ id: 'wiki', label: t('wiki.title'), isPinned: pinnedPanels.includes('wiki') }]}
        activeTabId="wiki"
        onSelect={() => {}}
        onClose={() => toggleTab('wiki')}
        onTogglePin={() => togglePanelPin('wiki')}
        panelDragHandlers={panelDragHandlers}
        actions={
          <div className="relative">
            <button
              onClick={() => setShowCategoryPicker(!showCategoryPicker)}
              className="p-1 rounded hover:bg-bg-hover text-text-secondary"
              title={t('common.add')}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {showCategoryPicker && (
              <CategoryPicker
                onSelect={handleAddEntry}
                onClose={() => setShowCategoryPicker(false)}
              />
            )}
          </div>
        }
      />

      {/* Search */}
      <div className="px-3 py-2">
        <WikiSearch />
      </div>

      {/* Categories */}
      <div className="px-2 pb-2 border-b border-border">
        <WikiCategoryList entryCounts={entryCounts} />
      </div>

      {/* Entry list */}
      <div className="flex-1 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-text-muted text-xs">
            {entries.length === 0 ? 'No wiki entries yet' : 'No matches'}
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredEntries.map(entry => (
              <button
                key={entry.id}
                onClick={() => selectEntry(entry.id)}
                className={cn(
                  'flex flex-col gap-0.5 px-3 py-2 text-left border-b border-border/50 transition',
                  'hover:bg-bg-hover',
                )}
              >
                <span className="text-xs font-medium text-text-primary truncate">
                  {entry.title || 'Untitled'}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-text-muted">
                    {entry.category}
                  </span>
                  {entry.tags.length > 0 && (
                    <span className="text-[10px] text-accent">
                      +{entry.tags.length} tags
                    </span>
                  )}
                </div>
                {entry.content && (
                  <span className="text-[10px] text-text-muted truncate">
                    {entry.content.slice(0, 60)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CategoryPicker({ onSelect, onClose }: {
  onSelect: (category: WikiCategory) => void
  onClose: () => void
}) {
  const [search, setSearch] = useState('')

  // Load recent categories from localStorage
  const [recentCategories] = useState<WikiCategory[]>(() => {
    try {
      const stored = localStorage.getItem('wiki_recent_categories')
      return stored ? JSON.parse(stored) : []
    } catch { return [] }
  })

  const matchesSearch = (cat: { label: string; labelKo: string }) => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return cat.labelKo.toLowerCase().includes(q) || cat.label.toLowerCase().includes(q)
  }

  const handleSelect = (category: WikiCategory) => {
    // Update recent categories in localStorage
    try {
      const recent = JSON.parse(localStorage.getItem('wiki_recent_categories') || '[]') as WikiCategory[]
      const updated = [category, ...recent.filter(c => c !== category)].slice(0, 5)
      localStorage.setItem('wiki_recent_categories', JSON.stringify(updated))
    } catch { /* ignore */ }
    onSelect(category)
  }

  const hasAnyResult = WIKI_CATEGORY_GROUPS.some(g =>
    g.categories.some(c => matchesSearch(c)),
  )

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-50 w-52 bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
        {/* Search input */}
        <div className="px-2 pt-2 pb-1">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="카테고리 검색..."
              className="w-full pl-6 pr-6 py-1 text-xs bg-bg-hover border border-border rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-muted"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto">
          {/* Recent categories */}
          {!search.trim() && recentCategories.length > 0 && (
            <>
              <div className="px-3 pt-2 pb-1 text-[10px] font-medium text-text-muted uppercase tracking-wide">
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
          {WIKI_CATEGORY_GROUPS.map(group => {
            const visibleCats = group.categories.filter(matchesSearch)
            if (visibleCats.length === 0) return null

            return (
              <div key={group.id}>
                <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[10px] font-medium text-text-muted uppercase tracking-wide">
                  {group.icon}
                  <span>{group.labelKo}</span>
                </div>
                {visibleCats.map(cat => (
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
            )
          })}

          {/* No results */}
          {!hasAnyResult && (
            <div className="px-3 py-4 text-center text-xs text-text-muted">
              검색 결과 없음
            </div>
          )}
        </div>
      </div>
    </>
  )
}
