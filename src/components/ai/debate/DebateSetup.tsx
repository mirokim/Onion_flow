/**
 * DebateSetup — Setup form for starting a new debate.
 * Ported from Onion Ring's TopicInput.tsx (simplified: no artwork, no camera).
 */
import { useState, useMemo } from 'react'
import { Play, AlertCircle, FileText, Upload, X, Sparkles, ArrowLeft } from 'lucide-react'
import { useAIStore } from '@/stores/aiStore'
import { useDebateStore } from '@/stores/debateStore'
import { cn } from '@/lib/utils'
import { generateId } from '@/lib/utils'
import { ROLE_OPTIONS, ROLE_GROUPS, DEBATE_PROVIDER_LABELS, DEBATE_PROVIDER_COLORS } from '@/ai/debateRoles'
import type { AIProvider, DiscussionMode, RoleConfig, ReferenceFile } from '@/types'

const DEBATE_MODES: DiscussionMode[] = ['roundRobin', 'freeDiscussion', 'roleAssignment', 'battle']

const MODE_LABELS: Record<DiscussionMode, string> = {
  roundRobin: '라운드 로빈',
  freeDiscussion: '자유 토론',
  roleAssignment: '역할 배정',
  battle: '결전모드',
}

const MODE_DESCRIPTIONS: Record<DiscussionMode, string> = {
  roundRobin: 'AI들이 순서대로 돌아가며 발언합니다',
  freeDiscussion: 'AI들이 자유롭게 서로의 의견에 반박/동의합니다',
  roleAssignment: '각 AI에 캐릭터/역할을 부여하여 토론합니다',
  battle: 'AI 2명이 대결하고 1명이 심판으로 채점합니다',
}

const DELAY_OPTIONS = [5, 10, 15, 30] as const
const REF_MAX_LENGTH = 10_000
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 5
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.pdf'

const ROLE_LABEL_MAP = new Map(ROLE_OPTIONS.map((r) => [r.value, r.label]))

const DEFAULT_SUGGESTIONS = [
  'AI가 인간의 창의성을 대체할 수 있는가?',
  '소셜 미디어는 민주주의에 도움이 되는가?',
  '원격 근무가 사무실 근무보다 생산적인가?',
  '우주 개발에 국가 예산을 투자해야 하는가?',
]

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

interface DebateSetupProps {
  onBack?: () => void
}

export function DebateSetup({ onBack }: DebateSetupProps) {
  const [topic, setTopic] = useState('')
  const [mode, setMode] = useState<DiscussionMode>('roundRobin')
  const [maxRounds, setMaxRounds] = useState(3)
  const [selectedProviders, setSelectedProviders] = useState<AIProvider[]>([])
  const [roles, setRoles] = useState<RoleConfig[]>([])
  const [judgeProvider, setJudgeProvider] = useState<AIProvider | null>(null)

  const [useReference, setUseReference] = useState(false)
  const [referenceText, setReferenceText] = useState('')
  const [referenceFiles, setReferenceFiles] = useState<ReferenceFile[]>([])

  const [pacingMode, setPacingMode] = useState<'auto' | 'manual'>('auto')
  const [autoDelay, setAutoDelay] = useState(5)

  const configs = useAIStore((s) => s.configs)
  const startDebate = useDebateStore((s) => s.startDebate)

  const allProviders: AIProvider[] = ['openai', 'anthropic', 'gemini', 'llama', 'grok']
  const enabledProviders = useMemo(
    () => allProviders.filter((p) => configs[p].enabled && configs[p].apiKey.trim().length > 0),
    [configs],
  )

  const canStart = topic.trim().length > 0
    && selectedProviders.length >= 2
    && (mode !== 'battle' || (selectedProviders.length >= 3 && judgeProvider !== null))

  const toggleProvider = (provider: AIProvider) => {
    setSelectedProviders((prev) => {
      const next = prev.includes(provider)
        ? prev.filter((p) => p !== provider)
        : [...prev, provider]
      setRoles((prevRoles) => {
        const existing = new Map(prevRoles.map((r) => [r.provider, r]))
        return next.map((p) => existing.get(p) || { provider: p, role: '중립' })
      })
      if (judgeProvider && !next.includes(judgeProvider)) {
        setJudgeProvider(null)
      }
      return next
    })
  }

  const updateRole = (provider: AIProvider, role: string) => {
    setRoles((prev) =>
      prev.map((r) => (r.provider === provider ? { ...r, role } : r)),
    )
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return
    const newFiles: ReferenceFile[] = []
    for (const file of Array.from(files)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size > MAX_FILE_SIZE) continue
      if (referenceFiles.length + newFiles.length >= MAX_FILES) break
      const dataUrl = await readFileAsDataUrl(file)
      newFiles.push({ id: generateId(), filename: file.name, mimeType: file.type, size: file.size, dataUrl })
    }
    setReferenceFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (id: string) => {
    setReferenceFiles((prev) => prev.filter((f) => f.id !== id))
  }

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

        {/* Topic Suggestions */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">추천 주제</span>
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {DEFAULT_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setTopic(s)}
                className={cn(
                  'text-left px-3 py-2 text-xs rounded-lg border transition-all leading-relaxed',
                  topic === s
                    ? 'bg-accent/10 border-accent/40 text-accent font-medium'
                    : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

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

        {/* Mode Selection */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">토론 모드</label>
          <div className="grid grid-cols-2 gap-1.5">
            {DEBATE_MODES.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  'px-3 py-2 text-xs rounded-lg border transition-all',
                  mode === m
                    ? 'bg-accent/10 border-accent/40 text-accent font-semibold'
                    : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
                )}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-text-muted pl-1">{MODE_DESCRIPTIONS[mode]}</p>
        </div>

        {/* Participants */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">참여 AI 선택</label>
          {enabledProviders.length < 2 && (
            <div className="flex items-center gap-2 text-warning text-xs bg-warning/10 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>설정에서 2개 이상의 AI를 활성화하고 API 키를 입력하세요</span>
            </div>
          )}
          {mode === 'battle' && selectedProviders.length < 3 && selectedProviders.length >= 2 && (
            <div className="flex items-center gap-2 text-warning text-xs bg-warning/10 px-3 py-2 rounded-lg">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>결전모드는 3개의 AI가 필요합니다 (토론자 2 + 심판 1)</span>
            </div>
          )}
          <div className="flex flex-wrap gap-1.5">
            {enabledProviders.map((p) => {
              const selected = selectedProviders.includes(p)
              return (
                <button
                  key={p}
                  onClick={() => toggleProvider(p)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
                    selected
                      ? 'border-transparent font-semibold shadow-sm'
                      : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
                  )}
                  style={
                    selected
                      ? {
                          backgroundColor: `${DEBATE_PROVIDER_COLORS[p]}12`,
                          borderColor: `${DEBATE_PROVIDER_COLORS[p]}60`,
                          color: DEBATE_PROVIDER_COLORS[p],
                        }
                      : undefined
                  }
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DEBATE_PROVIDER_COLORS[p] }} />
                  {DEBATE_PROVIDER_LABELS[p]}
                </button>
              )
            })}
          </div>
        </div>

        {/* Judge Selection (Battle Mode) */}
        {mode === 'battle' && selectedProviders.length >= 3 && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">심판 AI 선택</label>
            <div className="flex flex-wrap gap-1.5">
              {selectedProviders.map((p) => {
                const isJudge = judgeProvider === p
                return (
                  <button
                    key={p}
                    onClick={() => setJudgeProvider(p)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all',
                      isJudge
                        ? 'bg-warning/10 border-warning/40 text-warning font-semibold'
                        : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
                    )}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DEBATE_PROVIDER_COLORS[p] }} />
                    {DEBATE_PROVIDER_LABELS[p]}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Role Assignment */}
        {(mode === 'roleAssignment' || mode === 'battle') && selectedProviders.length > 0 && (
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
              {mode === 'battle' ? '캐릭터 배정 (선택)' : '역할 배정'}
            </label>
            <div className="space-y-1.5 bg-bg-surface rounded-lg p-2.5 border border-border">
              {selectedProviders.map((p) => {
                const isJudgeAI = mode === 'battle' && judgeProvider === p
                const role = roles.find((r) => r.provider === p)?.role || '중립'
                return (
                  <div key={p} className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: DEBATE_PROVIDER_COLORS[p] }} />
                    <span className="text-xs text-text-secondary w-14 font-medium">{DEBATE_PROVIDER_LABELS[p]}</span>
                    {isJudgeAI ? (
                      <span className="flex-1 px-2 py-1 text-xs text-warning font-semibold">심판</span>
                    ) : (
                      <select
                        value={role}
                        onChange={(e) => updateRole(p, e.target.value)}
                        className="flex-1 px-2 py-1 text-xs bg-bg-primary border border-border rounded text-text-primary focus:outline-none focus:ring-1 focus:ring-accent/30"
                      >
                        {ROLE_GROUPS.map((group) => (
                          <optgroup key={group.label} label={group.label}>
                            {group.roles.map((roleValue) => {
                              const roleLabel = ROLE_LABEL_MAP.get(roleValue)
                              if (!roleLabel) return null
                              return (
                                <option key={roleValue} value={roleLabel}>
                                  {roleLabel}
                                </option>
                              )
                            })}
                          </optgroup>
                        ))}
                      </select>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Rounds */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">
            라운드 수: <span className="text-accent font-bold text-xs">{maxRounds}</span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={maxRounds}
            onChange={(e) => setMaxRounds(Number(e.target.value))}
            className="w-full accent-accent"
          />
          <div className="flex justify-between text-[10px] text-text-muted px-0.5">
            <span>1</span>
            <span>10</span>
          </div>
        </div>

        {/* Reference Data */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              className={cn(
                'relative w-8 h-[18px] rounded-full transition-colors cursor-pointer',
                useReference ? 'bg-accent' : 'bg-bg-hover',
              )}
              onClick={() => setUseReference(!useReference)}
            >
              <div className={cn(
                'absolute top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform',
                useReference ? 'translate-x-[16px]' : 'translate-x-[2px]',
              )} />
            </div>
            <FileText className="w-3.5 h-3.5 text-text-secondary" />
            <span className="text-xs font-medium text-text-secondary">참고 자료 포함</span>
          </label>

          {useReference && (
            <div className="space-y-2 mt-2">
              <textarea
                value={referenceText}
                onChange={(e) => {
                  if (e.target.value.length <= REF_MAX_LENGTH) setReferenceText(e.target.value)
                }}
                placeholder="토론에 참고할 텍스트를 붙여넣으세요."
                className="w-full px-3 py-2.5 text-sm bg-bg-surface border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 transition placeholder:text-text-muted/60"
                rows={3}
              />
              <div className="flex justify-end">
                <span className={cn('text-[10px]', referenceText.length > REF_MAX_LENGTH * 0.9 ? 'text-warning' : 'text-text-muted')}>
                  {referenceText.length.toLocaleString()} / {REF_MAX_LENGTH.toLocaleString()}자
                </span>
              </div>

              {/* File Upload */}
              <label
                className={cn(
                  'flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-lg cursor-pointer transition-all',
                  referenceFiles.length >= MAX_FILES
                    ? 'border-border text-text-muted cursor-not-allowed opacity-40'
                    : 'border-border hover:border-accent/40 text-text-secondary hover:text-accent hover:bg-accent/5',
                )}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                onDrop={(e) => {
                  e.preventDefault(); e.stopPropagation()
                  if (referenceFiles.length < MAX_FILES) void handleFileUpload(e.dataTransfer.files)
                }}
              >
                <Upload className="w-4 h-4" />
                <span className="text-xs font-medium">이미지/PDF 드래그 또는 클릭</span>
                <span className="text-[10px] text-text-muted">최대 10MB | 최대 {MAX_FILES}개</span>
                <input
                  type="file"
                  accept={ACCEPTED_EXTENSIONS}
                  multiple
                  className="hidden"
                  onChange={(e) => void handleFileUpload(e.target.files)}
                  disabled={referenceFiles.length >= MAX_FILES}
                />
              </label>

              {referenceFiles.length > 0 && (
                <div className="space-y-1">
                  {referenceFiles.map((file) => (
                    <div key={file.id} className="flex items-center gap-2.5 px-2.5 py-1.5 bg-bg-surface rounded-lg border border-border">
                      {file.mimeType.startsWith('image/') ? (
                        <img src={file.dataUrl} alt={file.filename} className="w-8 h-8 object-cover rounded shrink-0" />
                      ) : (
                        <div className="w-8 h-8 flex items-center justify-center bg-bg-hover rounded shrink-0">
                          <FileText className="w-3.5 h-3.5 text-text-muted" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-text-primary truncate">{file.filename}</p>
                        <p className="text-[10px] text-text-muted">
                          {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                        </p>
                      </div>
                      <button onClick={() => removeFile(file.id)} className="p-1 hover:bg-error/15 rounded text-text-muted hover:text-error transition shrink-0">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pacing */}
        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">턴 속도 제어</label>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={() => setPacingMode('auto')}
              className={cn(
                'px-3 py-2 text-xs rounded-lg border transition-all',
                pacingMode === 'auto' ? 'bg-accent/10 border-accent/40 text-accent font-semibold' : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
              )}
            >
              자동
            </button>
            <button
              onClick={() => setPacingMode('manual')}
              className={cn(
                'px-3 py-2 text-xs rounded-lg border transition-all',
                pacingMode === 'manual' ? 'bg-accent/10 border-accent/40 text-accent font-semibold' : 'bg-bg-surface border-border text-text-secondary hover:bg-bg-hover',
              )}
            >
              수동
            </button>
          </div>

          {pacingMode === 'auto' ? (
            <div className="grid grid-cols-4 gap-1">
              {DELAY_OPTIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => setAutoDelay(d)}
                  className={cn(
                    'px-2 py-1.5 text-xs rounded-lg border transition-all',
                    autoDelay === d ? 'bg-accent/10 border-accent/30 text-accent font-medium' : 'bg-bg-surface border-border text-text-muted hover:bg-bg-hover',
                  )}
                >
                  {d}초
                </button>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-text-muted pl-1">각 AI 응답 후 '다음 턴' 버튼을 눌러야 진행됩니다</p>
          )}
        </div>

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
      </div>
    </div>
  )
}
