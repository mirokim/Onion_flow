import { Search, X } from 'lucide-react'
import { useWikiStore } from '@/stores/wikiStore'
import { useTranslation } from 'react-i18next'

export function WikiSearch() {
  const { t } = useTranslation()
  const { searchQuery, setSearchQuery } = useWikiStore()

  return (
    <div className="relative">
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t('wiki.search')}
        className="w-full pl-7 pr-7 py-1.5 text-xs bg-bg-hover border border-border rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-muted"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  )
}
