/**
 * StatsPopup - Comprehensive statistics popup with tabs.
 */
import { useMemo, useState } from 'react'
import { X, BarChart3, Users, BookOpen, Target } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { CharacterProminence } from './CharacterProminence'
import { ForeshadowRate } from './ForeshadowRate'
import { DailyGoalChart } from './DailyGoalChart'

interface StatsPopupProps {
  onClose: () => void
}

type StatsTab = 'overview' | 'characters' | 'foreshadows' | 'daily'

const tabs: { id: StatsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: '전체', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { id: 'characters', label: '캐릭터', icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'foreshadows', label: '복선', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { id: 'daily', label: '일일', icon: <Target className="w-3.5 h-3.5" /> },
]

function computeOverviewStats() {
  const chapters = useProjectStore.getState().chapters
  const totalChars = chapters.reduce((sum, ch) => sum + ch.wordCount, 0)
  const chapterCount = chapters.filter(ch => ch.type === 'chapter').length
  const volumeCount = chapters.filter(ch => ch.type === 'volume').length

  // Manuscript pages (200 chars per page for Korean novels)
  const pages200 = Math.ceil(totalChars / 200)
  // A4 pages (~1800 chars)
  const pagesA4 = Math.ceil(totalChars / 1800)
  // Novel pages (~500 chars)
  const pagesNovel = Math.ceil(totalChars / 500)
  // Reading time (500 chars/min for Korean)
  const readingTimeMin = Math.ceil(totalChars / 500)

  // Chapter word count distribution
  const chapterStats = chapters
    .filter(ch => ch.type === 'chapter')
    .sort((a, b) => a.order - b.order)
    .map(ch => ({ title: ch.title, wordCount: ch.wordCount }))

  const avgChapterWords = chapterCount > 0 ? Math.round(totalChars / chapterCount) : 0

  return {
    totalChars,
    chapterCount,
    volumeCount,
    pages200,
    pagesA4,
    pagesNovel,
    readingTimeMin,
    avgChapterWords,
    chapterStats,
  }
}

/** Embeddable stats content (no modal wrapper) */
export function StatsContent() {
  const [activeTab, setActiveTab] = useState<StatsTab>('overview')
  const chapters = useProjectStore(s => s.chapters)
  const overview = useMemo(() => computeOverviewStats(), [chapters])

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-1 pb-3">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors ${
              activeTab === tab.id ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard label="전체 글자 수" value={overview.totalChars.toLocaleString()} unit="자" />
              <StatCard label="원고지" value={overview.pages200.toLocaleString()} unit="매" />
              <StatCard label="예상 읽기 시간" value={overview.readingTimeMin.toLocaleString()} unit="분" />
              <StatCard label="챕터" value={String(overview.chapterCount)} />
              <StatCard label="권" value={String(overview.volumeCount)} />
              <StatCard label="평균 챕터 길이" value={overview.avgChapterWords.toLocaleString()} unit="자" />
            </div>
            {overview.chapterStats.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-medium text-text-secondary">챕터별 글자 수</h3>
                <div className="space-y-1">
                  {overview.chapterStats.map((ch, i) => {
                    const maxWc = Math.max(1, ...overview.chapterStats.map(c => c.wordCount))
                    return (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs w-20 truncate text-right text-text-secondary">{ch.title}</span>
                        <div className="flex-1 h-3 bg-bg-hover rounded-sm overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-sm" style={{ width: `${(ch.wordCount / maxWc) * 100}%` }} />
                        </div>
                        <span className="text-xs w-12 text-right text-text-secondary">{ch.wordCount.toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        {activeTab === 'characters' && <CharacterProminence />}
        {activeTab === 'foreshadows' && <ForeshadowRate />}
        {activeTab === 'daily' && <DailyGoalChart />}
      </div>
    </div>
  )
}

export function StatsPopup({ onClose }: StatsPopupProps) {
  const [activeTab, setActiveTab] = useState<StatsTab>('overview')
  const chapters = useProjectStore(s => s.chapters)
  const overview = useMemo(() => computeOverviewStats(), [chapters])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-xl w-[520px] max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold">통계</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-t transition-colors
                ${activeTab === tab.id
                  ? 'bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-b-2 border-blue-500'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]'
                }
              `}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Main stats grid */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="전체 글자 수" value={overview.totalChars.toLocaleString()} unit="자" />
                <StatCard label="원고지" value={overview.pages200.toLocaleString()} unit="매" />
                <StatCard label="예상 읽기 시간" value={overview.readingTimeMin.toLocaleString()} unit="분" />
                <StatCard label="챕터" value={String(overview.chapterCount)} />
                <StatCard label="권" value={String(overview.volumeCount)} />
                <StatCard label="평균 챕터 길이" value={overview.avgChapterWords.toLocaleString()} unit="자" />
              </div>

              {/* Chapter distribution */}
              {overview.chapterStats.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-[var(--color-text-secondary)]">챕터별 글자 수</h3>
                  <div className="space-y-1">
                    {overview.chapterStats.map((ch, i) => {
                      const maxWc = Math.max(1, ...overview.chapterStats.map(c => c.wordCount))
                      return (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs w-20 truncate text-right text-[var(--color-text-secondary)]">
                            {ch.title}
                          </span>
                          <div className="flex-1 h-3 bg-[var(--color-bg-tertiary)] rounded-sm overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-sm"
                              style={{ width: `${(ch.wordCount / maxWc) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs w-12 text-right text-[var(--color-text-secondary)]">
                            {ch.wordCount.toLocaleString()}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'characters' && <CharacterProminence />}
          {activeTab === 'foreshadows' && <ForeshadowRate />}
          {activeTab === 'daily' && <DailyGoalChart />}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] flex justify-end">
          <button
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="bg-[var(--color-bg-secondary)] rounded-lg p-3">
      <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
      <div className="mt-1 text-lg font-semibold">
        {value}
        {unit && <span className="text-xs font-normal text-[var(--color-text-secondary)] ml-0.5">{unit}</span>}
      </div>
    </div>
  )
}
