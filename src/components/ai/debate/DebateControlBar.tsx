/**
 * DebateControlBar — Status, round counter, pacing controls.
 * Ported from Onion Ring's ControlBar.tsx (without share).
 */
import { Pause, Play, Square, SkipForward, Plus } from 'lucide-react'
import { useDebateStore } from '@/stores/debateStore'
import { DEBATE_PROVIDER_LABELS, DEBATE_PROVIDER_COLORS } from '@/ai/debateRoles'
import { cn } from '@/lib/utils'
import type { AIProvider } from '@/types'

const STATUS_LABELS: Record<string, string> = {
  running: '진행 중',
  paused: '일시 정지',
  completed: '완료',
  stopped: '중단됨',
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-success/15 text-success',
  paused: 'bg-warning/15 text-warning',
  completed: 'bg-accent/15 text-accent',
  stopped: 'bg-error/15 text-error',
}

export function DebateControlBar() {
  const status = useDebateStore((s) => s.status)
  const config = useDebateStore((s) => s.config)
  const currentRound = useDebateStore((s) => s.currentRound)
  const loadingProvider = useDebateStore((s) => s.loadingProvider)
  const countdown = useDebateStore((s) => s.countdown)
  const waitingForNext = useDebateStore((s) => s.waitingForNext)
  const pauseDebate = useDebateStore((s) => s.pauseDebate)
  const resumeDebate = useDebateStore((s) => s.resumeDebate)
  const stopDebate = useDebateStore((s) => s.stopDebate)
  const nextTurn = useDebateStore((s) => s.nextTurn)
  const reset = useDebateStore((s) => s.reset)

  const maxRounds = config?.maxRounds || 3
  const isFinished = status === 'completed' || status === 'stopped'

  return (
    <div className="border-b border-border flex items-center justify-between px-3 py-2 shrink-0 bg-bg-secondary/60">
      {/* Left: status info */}
      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className={cn(
          'px-2 py-0.5 rounded-md text-[10px] font-semibold',
          STATUS_COLORS[status] || 'bg-bg-surface text-text-muted',
        )}>
          {STATUS_LABELS[status] || status}
        </span>

        <span className="text-text-muted font-medium">
          R<span className="text-text-secondary">{currentRound}</span>/{maxRounds}
        </span>

        {config && (
          <div className="flex items-center gap-1">
            {config.participants.map((p: AIProvider) => {
              const isJudge = config.mode === 'battle' && config.judgeProvider === p
              return (
                <div
                  key={p}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    loadingProvider === p && 'ring-2 ring-offset-1 ring-offset-bg-secondary animate-pulse',
                    isJudge && 'ring-1 ring-warning',
                  )}
                  style={{ backgroundColor: DEBATE_PROVIDER_COLORS[p] || '#888' }}
                  title={`${DEBATE_PROVIDER_LABELS[p] || p}${isJudge ? ' (심판)' : ''}`}
                />
              )
            })}
          </div>
        )}

        {loadingProvider && (
          <span className="flex items-center gap-1 text-[11px]">
            <span style={{ color: DEBATE_PROVIDER_COLORS[loadingProvider] || '#888' }} className="font-medium">
              {DEBATE_PROVIDER_LABELS[loadingProvider] || loadingProvider}
            </span>
            <span className="text-text-muted">응답 중</span>
          </span>
        )}

        {countdown > 0 && (
          <span className="text-[11px] text-warning font-mono tabular-nums bg-warning/10 px-1.5 py-0.5 rounded">
            {countdown}s
          </span>
        )}

        {waitingForNext && (
          <button
            onClick={nextTurn}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition animate-pulse"
          >
            <SkipForward className="w-3.5 h-3.5" />
            다음 턴
          </button>
        )}
      </div>

      {/* Right: control buttons */}
      <div className="flex items-center gap-0.5">
        {status === 'running' && (
          <button
            onClick={pauseDebate}
            className="p-1.5 hover:bg-bg-hover rounded-lg transition text-text-secondary hover:text-warning"
            title="일시 정지"
          >
            <Pause className="w-3.5 h-3.5" />
          </button>
        )}
        {status === 'paused' && (
          <button
            onClick={resumeDebate}
            className="p-1.5 hover:bg-bg-hover rounded-lg transition text-text-secondary hover:text-success"
            title="계속하기"
          >
            <Play className="w-3.5 h-3.5" />
          </button>
        )}
        {(status === 'running' || status === 'paused') && (
          <button
            onClick={stopDebate}
            className="p-1.5 hover:bg-bg-hover rounded-lg transition text-text-secondary hover:text-error"
            title="종료"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
        )}
        {isFinished && (
          <button
            onClick={reset}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-accent bg-accent/10 rounded-lg hover:bg-accent/20 transition"
          >
            <Plus className="w-3 h-3" />
            새 토론
          </button>
        )}
      </div>
    </div>
  )
}
