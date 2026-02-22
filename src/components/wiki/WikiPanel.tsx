import { useMemo, useState } from 'react'
import { Plus, BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useWikiStore } from '@/stores/wikiStore'
import { useProjectStore } from '@/stores/projectStore'
import type { WikiCategory } from '@/types'
import { WikiSearch } from './WikiSearch'
import { WikiCategoryList } from './WikiCategoryList'
import { WikiEntryEditor } from './WikiEntryEditor'
import { cn } from '@/lib/utils'

export function WikiPanel() {
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
      />
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <BookOpen className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs font-medium text-text-primary">{t('wiki.title')}</span>
        <div className="flex-1" />
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
      </div>

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
  const categories: { key: WikiCategory; label: string }[] = [
    { key: 'character', label: '캐릭터' },
    { key: 'item', label: '아이템' },
    { key: 'magic', label: '마법 체계' },
    { key: 'technology', label: '기술' },
    { key: 'geography', label: '지리' },
    { key: 'politics', label: '정치' },
    { key: 'culture', label: '문화' },
    { key: 'history', label: '역사' },
    { key: 'religion', label: '종교' },
    { key: 'economy', label: '경제' },
    { key: 'language', label: '언어' },
    { key: 'species', label: '종족/생물' },
    { key: 'society', label: '사회' },
    { key: 'disease', label: '질병' },
    { key: 'other', label: '기타' },
    { key: 'custom', label: '사용자 정의' },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
        <div className="max-h-60 overflow-y-auto">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => onSelect(cat.key)}
              className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover hover:text-text-primary transition"
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
