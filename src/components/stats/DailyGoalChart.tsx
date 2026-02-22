/**
 * DailyGoalChart - Shows daily writing stats as a simple bar chart.
 */
import { useMemo, useEffect, useState } from 'react'
import { getAdapter } from '@/db/storageAdapter'
import { useProjectStore } from '@/stores/projectStore'
import type { DailyStats } from '@/types'

function getLast14Days(): string[] {
  const days: string[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export function DailyGoalChart() {
  const currentProject = useProjectStore(s => s.currentProject)
  const [stats, setStats] = useState<DailyStats[]>([])
  const target = currentProject?.settings.targetDailyWords || 3000

  useEffect(() => {
    if (!currentProject) return
    getAdapter().fetchDailyStats(currentProject.id).then(setStats)
  }, [currentProject])

  const days = useMemo(() => getLast14Days(), [])
  const statsMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of stats) {
      map.set(s.date, s.wordsWritten)
    }
    return map
  }, [stats])

  const maxVal = useMemo(() => {
    let max = target
    for (const [, v] of statsMap) {
      if (v > max) max = v
    }
    return max
  }, [statsMap, target])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-[var(--color-text-secondary)]">일일 집필량 (14일)</h3>
        <span className="text-xs text-[var(--color-text-secondary)]">목표: {target.toLocaleString()}자</span>
      </div>

      <div className="flex items-end gap-1 h-24">
        {days.map(day => {
          const count = statsMap.get(day) || 0
          const height = maxVal > 0 ? (count / maxVal) * 100 : 0
          const reached = count >= target
          const dayLabel = day.slice(8)

          return (
            <div key={day} className="flex-1 flex flex-col items-center gap-0.5">
              <div className="w-full flex flex-col justify-end h-20">
                <div
                  className={`w-full rounded-t-sm transition-all ${
                    reached ? 'bg-green-500' : count > 0 ? 'bg-blue-500' : 'bg-[var(--color-bg-tertiary)]'
                  }`}
                  style={{ height: `${Math.max(2, height)}%` }}
                  title={`${day}: ${count.toLocaleString()}자`}
                />
              </div>
              <span className="text-[9px] text-[var(--color-text-secondary)]">{dayLabel}</span>
            </div>
          )
        })}
      </div>

      {/* Target line indicator */}
      <div className="relative h-0 -mt-[calc(80px*var(--target-pct)/100)]" style={{ '--target-pct': (target / maxVal) * 100 } as any}>
        <div className="absolute w-full border-t border-dashed border-yellow-500/30" />
      </div>
    </div>
  )
}
