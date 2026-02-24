/**
 * DebateSetup — Simplified setup form for starting a new debate.
 * Only contains topic input and start button.
 * All other settings (mode, participants, roles, rounds, pacing, reference)
 * are configured in Settings > 토론.
 */
import { useState } from 'react'
import { Play, ArrowLeft, Settings } from 'lucide-react'
import { useDebateStore } from '@/stores/debateStore'
import { cn } from '@/lib/utils'

interface DebateSetupProps {
  onBack?: () => void
  onOpenSettings?: () => void
}

export function DebateSetup({ onBack, onOpenSettings }: DebateSetupProps) {
  const [topic, setTopic] = useState('')

  const settings = useDebateStore((s) => s.settings)
  const startDebate = useDebateStore((s) => s.startDebate)

  const { mode, maxRounds, selectedProviders, roles, judgeProvider, useReference, referenceText, referenceFiles, pacingMode, autoDelay } = settings

  const canStart = topic.trim().length > 0
    && selectedProviders.length >= 2
    && (mode !== 'battle' || (selectedProviders.length >= 3 && judgeProvider !== null))

  const handleStart = () => {
    if (!canStart) return
    startDebate({
      mode,
      topic: topic.trim(),
      maxRounds,
      participants: selectedProviders,
      roles: (mode === 'roleAssignment' || mode === 'battle') ? roles : [],
      judgeProvider: mode === 'battle' ? judgeProvider ?? undefined : undefined,
      referenceText: useReference ? referenceText : '',
      useReference,
      referenceFiles: useReference ? referenceFiles : [],
      pacing: { mode: pacingMode, autoDelaySeconds: autoDelay },
    })
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Back to Chat */}
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text-primary transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            채팅으로 돌아가기
          </button>
        )}

        {/* Topic */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">토론 주제</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="토론 주제를 입력하세요..."
            className="w-full px-3 py-2.5 text-sm bg-bg-surface border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition placeholder:text-text-muted/60"
            rows={2}
          />
        </div>

        {/* Validation message */}
        {selectedProviders.length < 2 && (
          <p className="text-[11px] text-warning">
            설정에서 2개 이상의 AI를 선택하세요.{' '}
            {onOpenSettings && (
              <button onClick={onOpenSettings} className="underline hover:text-accent transition">
                토론 설정 열기
              </button>
            )}
          </p>
        )}

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all',
            canStart
              ? 'bg-accent text-white hover:bg-accent-dim shadow-lg shadow-accent/20 active:scale-[0.98]'
              : 'bg-bg-surface text-text-muted cursor-not-allowed',
          )}
        >
          <Play className="w-4 h-4" />
          {mode === 'battle' ? '결전 시작' : '토론 시작'}
        </button>

        {/* Settings shortcut */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs text-text-muted hover:text-text-primary hover:bg-bg-hover border border-border transition"
          >
            <Settings className="w-3.5 h-3.5" />
            토론 설정
          </button>
        )}
      </div>
    </div>
  )
}
