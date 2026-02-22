import { useWikiStore } from '@/stores/wikiStore'
import type { WikiCategory } from '@/types'
import { cn } from '@/lib/utils'
import {
  Sparkles, Cpu, Globe2, Landmark, Palette, BookOpen,
  Church, Coins, Languages, Bug, Users, HeartPulse,
  Package, UserCircle, Sword, FolderOpen,
} from 'lucide-react'

const WIKI_CATEGORIES: { key: WikiCategory | 'all'; icon: React.ReactNode; label: string; labelKo: string }[] = [
  { key: 'all', icon: <FolderOpen className="w-3.5 h-3.5" />, label: 'All', labelKo: '전체' },
  { key: 'character', icon: <UserCircle className="w-3.5 h-3.5" />, label: 'Character', labelKo: '캐릭터' },
  { key: 'item', icon: <Sword className="w-3.5 h-3.5" />, label: 'Item', labelKo: '아이템' },
  { key: 'magic', icon: <Sparkles className="w-3.5 h-3.5" />, label: 'Magic', labelKo: '마법 체계' },
  { key: 'technology', icon: <Cpu className="w-3.5 h-3.5" />, label: 'Technology', labelKo: '기술' },
  { key: 'geography', icon: <Globe2 className="w-3.5 h-3.5" />, label: 'Geography', labelKo: '지리' },
  { key: 'politics', icon: <Landmark className="w-3.5 h-3.5" />, label: 'Politics', labelKo: '정치' },
  { key: 'culture', icon: <Palette className="w-3.5 h-3.5" />, label: 'Culture', labelKo: '문화' },
  { key: 'history', icon: <BookOpen className="w-3.5 h-3.5" />, label: 'History', labelKo: '역사' },
  { key: 'religion', icon: <Church className="w-3.5 h-3.5" />, label: 'Religion', labelKo: '종교' },
  { key: 'economy', icon: <Coins className="w-3.5 h-3.5" />, label: 'Economy', labelKo: '경제' },
  { key: 'language', icon: <Languages className="w-3.5 h-3.5" />, label: 'Language', labelKo: '언어' },
  { key: 'species', icon: <Bug className="w-3.5 h-3.5" />, label: 'Species', labelKo: '종족/생물' },
  { key: 'society', icon: <Users className="w-3.5 h-3.5" />, label: 'Society', labelKo: '사회' },
  { key: 'disease', icon: <HeartPulse className="w-3.5 h-3.5" />, label: 'Disease', labelKo: '질병' },
  { key: 'other', icon: <Package className="w-3.5 h-3.5" />, label: 'Other', labelKo: '기타' },
  { key: 'custom', icon: <Package className="w-3.5 h-3.5" />, label: 'Custom', labelKo: '사용자 정의' },
]

interface WikiCategoryListProps {
  entryCounts: Record<string, number>
}

export function WikiCategoryList({ entryCounts }: WikiCategoryListProps) {
  const { filterCategory, setFilterCategory } = useWikiStore()

  return (
    <div className="flex flex-col gap-0.5">
      {WIKI_CATEGORIES.map(cat => {
        const count = cat.key === 'all'
          ? Object.values(entryCounts).reduce((a, b) => a + b, 0)
          : (entryCounts[cat.key] ?? 0)

        if (cat.key !== 'all' && count === 0) return null

        return (
          <button
            key={cat.key}
            onClick={() => setFilterCategory(cat.key)}
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded text-xs transition',
              filterCategory === cat.key
                ? 'bg-accent/15 text-accent'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            {cat.icon}
            <span className="flex-1 text-left truncate">{cat.labelKo}</span>
            <span className="text-[10px] text-text-muted">{count}</span>
          </button>
        )
      })}
    </div>
  )
}

export { WIKI_CATEGORIES }
