import { useState } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import type { WikiCategory, WikiFilterCategory } from '@/types'
import { cn } from '@/lib/utils'
import {
  Sparkles, Cpu, Globe2, Landmark, Palette, BookOpen,
  Church, Coins, Languages, Bug, Users, HeartPulse,
  Package, UserCircle, Sword, FolderOpen,
  Clock, Zap, FileText, GitBranch,
  ChevronDown, ChevronRight,
} from 'lucide-react'

// ── Category item type ──

interface CategoryItem {
  key: WikiCategory
  icon: React.ReactNode
  label: string
  labelKo: string
}

// ── Group definition ──

interface CategoryGroup {
  id: WikiFilterCategory
  labelKo: string
  icon: React.ReactNode
  defaultCollapsed: boolean
  categories: CategoryItem[]
}

const WIKI_CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'group_character',
    labelKo: '캐릭터',
    icon: <UserCircle className="w-3.5 h-3.5" />,
    defaultCollapsed: false,
    categories: [
      { key: 'character', icon: <UserCircle className="w-3 h-3" />, label: 'Character', labelKo: '캐릭터' },
      { key: 'character_memory', icon: <Clock className="w-3 h-3" />, label: 'Memory', labelKo: '기억' },
      { key: 'character_motivation', icon: <HeartPulse className="w-3 h-3" />, label: 'Motivation', labelKo: '동기' },
    ],
  },
  {
    id: 'group_narrative',
    labelKo: '서사',
    icon: <Zap className="w-3.5 h-3.5" />,
    defaultCollapsed: false,
    categories: [
      { key: 'event', icon: <Zap className="w-3 h-3" />, label: 'Event', labelKo: '사건/환경' },
      { key: 'story', icon: <FileText className="w-3 h-3" />, label: 'Story', labelKo: '스토리' },
      { key: 'plot', icon: <GitBranch className="w-3 h-3" />, label: 'Plot', labelKo: '플롯' },
    ],
  },
  {
    id: 'group_world',
    labelKo: '세계관',
    icon: <Globe2 className="w-3.5 h-3.5" />,
    defaultCollapsed: true,
    categories: [
      { key: 'magic', icon: <Sparkles className="w-3 h-3" />, label: 'Magic', labelKo: '마법 체계' },
      { key: 'technology', icon: <Cpu className="w-3 h-3" />, label: 'Technology', labelKo: '기술' },
      { key: 'geography', icon: <Globe2 className="w-3 h-3" />, label: 'Geography', labelKo: '지리' },
      { key: 'politics', icon: <Landmark className="w-3 h-3" />, label: 'Politics', labelKo: '정치' },
      { key: 'culture', icon: <Palette className="w-3 h-3" />, label: 'Culture', labelKo: '문화' },
      { key: 'history', icon: <BookOpen className="w-3 h-3" />, label: 'History', labelKo: '역사' },
      { key: 'religion', icon: <Church className="w-3 h-3" />, label: 'Religion', labelKo: '종교' },
      { key: 'economy', icon: <Coins className="w-3 h-3" />, label: 'Economy', labelKo: '경제' },
      { key: 'language', icon: <Languages className="w-3 h-3" />, label: 'Language', labelKo: '언어' },
      { key: 'species', icon: <Bug className="w-3 h-3" />, label: 'Species', labelKo: '종족/생물' },
      { key: 'society', icon: <Users className="w-3 h-3" />, label: 'Society', labelKo: '사회' },
      { key: 'disease', icon: <HeartPulse className="w-3 h-3" />, label: 'Disease', labelKo: '질병' },
      { key: 'other', icon: <Package className="w-3 h-3" />, label: 'Other', labelKo: '기타' },
    ],
  },
  {
    id: 'group_other',
    labelKo: '기타',
    icon: <Package className="w-3.5 h-3.5" />,
    defaultCollapsed: false,
    categories: [
      { key: 'item', icon: <Sword className="w-3 h-3" />, label: 'Item', labelKo: '아이템' },
      { key: 'custom', icon: <Package className="w-3 h-3" />, label: 'Custom', labelKo: '사용자 정의' },
    ],
  },
]

// ── Exported maps for store & other components ──

/** Group ID → WikiCategory[] mapping (used by wikiStore for group filtering) */
export const CATEGORY_GROUP_MAP: Record<string, WikiCategory[]> = Object.fromEntries(
  WIKI_CATEGORY_GROUPS.map(g => [g.id, g.categories.map(c => c.key)]),
)

/** Backward-compatible flat category list (used by WikiEntryEditor) */
export const WIKI_CATEGORIES: { key: WikiCategory; icon: React.ReactNode; label: string; labelKo: string }[] =
  WIKI_CATEGORY_GROUPS.flatMap(g => g.categories)

/** Exported groups for CategoryPicker in WikiPanel */
export { WIKI_CATEGORY_GROUPS }

// ── Component ──

interface WikiCategoryListProps {
  entryCounts: Record<string, number>
}

export function WikiCategoryList({ entryCounts }: WikiCategoryListProps) {
  const { filterCategory, setFilterCategory } = useWikiStore()

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(WIKI_CATEGORY_GROUPS.map(g => [g.id, g.defaultCollapsed])),
  )

  const toggleGroup = (groupId: string) => {
    setCollapsed(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const totalCount = Object.values(entryCounts).reduce((a, b) => a + b, 0)

  const getGroupCount = (group: CategoryGroup): number =>
    group.categories.reduce((sum, cat) => sum + (entryCounts[cat.key] ?? 0), 0)

  return (
    <div className="flex flex-col gap-0.5">
      {/* "전체" button */}
      <button
        onClick={() => setFilterCategory('all')}
        className={cn(
          'flex items-center gap-2 px-2 py-1 rounded text-xs transition',
          filterCategory === 'all'
            ? 'bg-accent/15 text-accent'
            : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
        )}
      >
        <FolderOpen className="w-3.5 h-3.5" />
        <span className="flex-1 text-left truncate">전체</span>
        <span className="text-[10px] text-text-muted">{totalCount}</span>
      </button>

      {/* Category groups */}
      {WIKI_CATEGORY_GROUPS.map(group => {
        const groupCount = getGroupCount(group)
        const isGroupActive = filterCategory === group.id
        const isChildActive = group.categories.some(c => c.key === filterCategory)
        const isGroupFiltered = isGroupActive || isChildActive

        // Hide empty groups (unless actively filtered)
        if (groupCount === 0 && !isGroupFiltered) return null

        // Auto-expand when a child is active
        const isCollapsed = collapsed[group.id] && !isChildActive

        return (
          <div key={group.id}>
            {/* Group header */}
            <button
              onClick={() => setFilterCategory(group.id)}
              className={cn(
                'flex items-center gap-2 w-full px-2 py-1 rounded text-xs font-medium transition',
                isGroupActive
                  ? 'bg-accent/15 text-accent'
                  : isChildActive
                    ? 'text-accent/80'
                    : 'text-text-primary hover:bg-bg-hover',
              )}
            >
              {group.icon}
              <span className="flex-1 text-left truncate">{group.labelKo}</span>
              <span className="text-[10px] text-text-muted mr-1">{groupCount}</span>
              <span
                role="button"
                onClick={(e) => { e.stopPropagation(); toggleGroup(group.id as string) }}
                className="text-text-muted hover:text-text-primary p-0.5 rounded hover:bg-bg-active transition"
              >
                {isCollapsed
                  ? <ChevronRight className="w-3 h-3" />
                  : <ChevronDown className="w-3 h-3" />
                }
              </span>
            </button>

            {/* Collapsible sub-items */}
            <div
              className={cn(
                'grid overflow-hidden transition-[grid-template-rows] duration-200 ease-in-out',
                isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
              )}
            >
              <div className="min-h-0">
                {group.categories.map(cat => {
                  const count = entryCounts[cat.key] ?? 0
                  // Hide empty sub-items unless actively selected
                  if (count === 0 && filterCategory !== cat.key && !isGroupActive) return null

                  return (
                    <button
                      key={cat.key}
                      onClick={() => setFilterCategory(cat.key)}
                      className={cn(
                        'flex items-center gap-2 w-full pl-6 pr-2 py-0.5 rounded text-xs transition',
                        filterCategory === cat.key
                          ? 'bg-accent/15 text-accent'
                          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                      )}
                    >
                      {cat.icon}
                      <span className="flex-1 text-left truncate">{cat.labelKo}</span>
                      {count > 0 && (
                        <span className="text-[10px] text-text-muted">{count}</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
