/**
 * ForeshadowRate - Shows planted vs resolved foreshadow ratio.
 */
import { useMemo } from 'react'
import { useWorldStore } from '@/stores/worldStore'

export function ForeshadowRate() {
  const foreshadows = useWorldStore(s => s.foreshadows)

  const stats = useMemo(() => {
    const total = foreshadows.length
    const planted = foreshadows.filter(f => f.status === 'planted').length
    const hinted = foreshadows.filter(f => f.status === 'hinted').length
    const resolved = foreshadows.filter(f => f.status === 'resolved').length
    const abandoned = foreshadows.filter(f => f.status === 'abandoned').length
    const rate = total > 0 ? Math.round((resolved / total) * 100) : 0
    return { total, planted, hinted, resolved, abandoned, rate }
  }, [foreshadows])

  if (stats.total === 0) {
    return (
      <div className="text-xs text-[var(--color-text-secondary)] text-center py-4">
        등록된 복선이 없습니다
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium text-[var(--color-text-secondary)]">복선 해소율</h3>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-[var(--color-text-secondary)]">해소율</span>
          <span className="text-sm font-semibold">{stats.rate}%</span>
        </div>
        <div className="h-3 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden flex">
          {stats.resolved > 0 && (
            <div
              className="h-full bg-green-500"
              style={{ width: `${(stats.resolved / stats.total) * 100}%` }}
              title={`해소됨: ${stats.resolved}`}
            />
          )}
          {stats.hinted > 0 && (
            <div
              className="h-full bg-yellow-500"
              style={{ width: `${(stats.hinted / stats.total) * 100}%` }}
              title={`힌트: ${stats.hinted}`}
            />
          )}
          {stats.planted > 0 && (
            <div
              className="h-full bg-blue-500"
              style={{ width: `${(stats.planted / stats.total) * 100}%` }}
              title={`심음: ${stats.planted}`}
            />
          )}
          {stats.abandoned > 0 && (
            <div
              className="h-full bg-gray-500"
              style={{ width: `${(stats.abandoned / stats.total) * 100}%` }}
              title={`폐기: ${stats.abandoned}`}
            />
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span>심음 {stats.planted}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-yellow-500" />
          <span>힌트 {stats.hinted}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span>해소 {stats.resolved}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span>폐기 {stats.abandoned}</span>
        </div>
      </div>
    </div>
  )
}
