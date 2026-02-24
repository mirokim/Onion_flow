import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useWorldStore } from '@/stores/worldStore'
import { useSaveStatusStore } from '@/stores/saveStatusStore'
import type { Character, CharacterArchetype, CharacterStatus } from '@/types'
import {
  User, Briefcase, Building2, Quote, Drama, ImagePlus,
  Eye, Mic, Gem, Repeat, Heart, ShieldAlert, Skull,
  KeyRound, Scale, ChevronDown, ChevronRight,
} from 'lucide-react'

interface CharacterWikiFieldsProps {
  characterId: string
}

const ARCHETYPE_OPTIONS: { value: CharacterArchetype; label: string }[] = [
  { value: 'protagonist', label: '주인공' },
  { value: 'antagonist', label: '적대자' },
  { value: 'helper', label: '조력자' },
  { value: 'mentor', label: '멘토' },
  { value: 'betrayer', label: '배신자' },
  { value: 'guardian', label: '수호자' },
  { value: 'trickster', label: '트릭스터' },
  { value: 'shapeshifter', label: '변신자' },
  { value: 'herald', label: '전령' },
  { value: 'shadow', label: '그림자' },
  { value: 'threshold_guardian', label: '문턱의 수호자' },
  { value: 'ally', label: '동맹' },
  { value: 'other', label: '기타' },
]

const STATUS_OPTIONS: { value: CharacterStatus; label: string }[] = [
  { value: 'alive', label: '생존' },
  { value: 'dead', label: '사망' },
  { value: 'missing', label: '실종' },
  { value: 'unknown', label: '불명' },
]

/** Auto-sizing textarea */
function AutoField({ value, onChange, placeholder, className }: {
  value: string; onChange: (v: string) => void; placeholder?: string; className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      rows={1}
    />
  )
}

/** Collapsible section */
function Section({ title, icon, defaultOpen = true, children }: {
  title: string; icon: React.ReactNode; defaultOpen?: boolean; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-3 py-2 bg-bg-hover/50 hover:bg-bg-hover text-xs font-semibold text-text-primary transition"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {open ? <ChevronDown className="w-3 h-3 text-text-muted" /> : <ChevronRight className="w-3 h-3 text-text-muted" />}
      </button>
      {open && (
        <div className="px-3 py-2.5 space-y-2.5 bg-bg-primary/30">
          {children}
        </div>
      )}
    </div>
  )
}

/** Label + input row */
function Field({ label, icon, children }: {
  label: string; icon: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div className="space-y-1">
      <label className="flex items-center gap-1.5 text-[11px] font-medium text-text-secondary">
        {icon}
        {label}
      </label>
      {children}
    </div>
  )
}

const INPUT_CLASS = "w-full text-xs px-2.5 py-1.5 bg-bg-primary border border-border rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-muted transition"
const TEXTAREA_CLASS = "w-full text-xs px-2.5 py-1.5 bg-bg-primary border border-border rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-muted resize-none leading-relaxed transition"
const SELECT_CLASS = "w-full text-xs px-2.5 py-1.5 bg-bg-primary border border-border rounded focus:outline-none focus:border-accent text-text-primary cursor-pointer transition"

/**
 * Hook: local-state-buffered character editing.
 * Maintains local overrides so controlled inputs remain responsive,
 * and ACCUMULATES all pending changes before flushing to the store (debounced).
 */
function useLocalCharacter(characterId: string) {
  const storeCharacters = useWorldStore(s => s.characters)
  const updateCharacter = useWorldStore(s => s.updateCharacter)
  const storeChar = useMemo(
    () => storeCharacters.find(c => c.id === characterId) ?? null,
    [storeCharacters, characterId],
  )

  // Local overrides for responsive input
  const [overrides, setOverrides] = useState<Partial<Character>>({})
  const pendingRef = useRef<Partial<Character>>({})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const updateRef = useRef(updateCharacter)
  const idRef = useRef(characterId)
  updateRef.current = updateCharacter
  idRef.current = characterId

  // Reset overrides when switching characters
  useEffect(() => {
    setOverrides({})
    pendingRef.current = {}
  }, [characterId])

  // Merged character = store + local overrides (local wins)
  const character = useMemo(
    () => storeChar ? { ...storeChar, ...overrides } : null,
    [storeChar, overrides],
  )

  const flush = useCallback(async () => {
    const pending = { ...pendingRef.current }
    if (Object.keys(pending).length === 0) return
    pendingRef.current = {}
    setOverrides({})
    useSaveStatusStore.getState().setSaving()
    await updateRef.current(idRef.current, pending)
    useSaveStatusStore.getState().setSaved()
  }, [])

  const update = useCallback((updates: Partial<Character>) => {
    // 1. Immediate local state update → UI stays responsive
    setOverrides(prev => ({ ...prev, ...updates }))
    // 2. Accumulate all pending changes
    pendingRef.current = { ...pendingRef.current, ...updates }
    useSaveStatusStore.getState().setModified()
    // 3. Debounce the actual store + DB save
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => flush(), 500)
  }, [flush])

  // Flush on unmount to prevent data loss
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      const pending = pendingRef.current
      if (Object.keys(pending).length > 0) {
        updateRef.current(idRef.current, pending)
      }
    }
  }, [])

  return { character, update }
}

export function CharacterWikiFields({ characterId }: CharacterWikiFieldsProps) {
  const { character, update } = useLocalCharacter(characterId)

  if (!character) return null

  return (
    <div className="space-y-2.5">
      {/* ── 기본 정보 ── */}
      <Section title="기본 정보" icon={<User className="w-3.5 h-3.5 text-accent" />} defaultOpen={true}>
        <div className="grid grid-cols-2 gap-2">
          <Field label="이름" icon={<User className="w-3 h-3" />}>
            <input
              type="text"
              value={character.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="캐릭터 이름"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="나이" icon={<User className="w-3 h-3" />}>
            <input
              type="text"
              value={character.age}
              onChange={(e) => update({ age: e.target.value })}
              placeholder="예: 25세"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="직업" icon={<Briefcase className="w-3 h-3" />}>
            <input
              type="text"
              value={character.job}
              onChange={(e) => update({ job: e.target.value })}
              placeholder="직업/직함"
              className={INPUT_CLASS}
            />
          </Field>
          <Field label="소속" icon={<Building2 className="w-3 h-3" />}>
            <input
              type="text"
              value={character.affiliation}
              onChange={(e) => update({ affiliation: e.target.value })}
              placeholder="조직/세력"
              className={INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label="한줄 요약 (로그라인)" icon={<Quote className="w-3 h-3" />}>
          <input
            type="text"
            value={character.logline}
            onChange={(e) => update({ logline: e.target.value })}
            placeholder="이 캐릭터를 한 문장으로 설명하면..."
            className={INPUT_CLASS}
          />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <Field label="아키타입" icon={<Drama className="w-3 h-3" />}>
            <select
              value={character.archetype}
              onChange={(e) => update({ archetype: e.target.value as CharacterArchetype })}
              className={SELECT_CLASS}
            >
              {ARCHETYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
          <Field label="상태" icon={<ShieldAlert className="w-3 h-3" />}>
            <select
              value={character.status}
              onChange={(e) => update({ status: e.target.value as CharacterStatus })}
              className={SELECT_CLASS}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </Section>

      {/* ── 캐릭터 이미지 ── */}
      <Section title="캐릭터 이미지" icon={<ImagePlus className="w-3.5 h-3.5 text-pink-400" />} defaultOpen={false}>
        <Field label="이미지 URL" icon={<ImagePlus className="w-3 h-3" />}>
          <input
            type="text"
            value={character.imageUrl}
            onChange={(e) => update({ imageUrl: e.target.value })}
            placeholder="이미지 URL을 입력하세요"
            className={INPUT_CLASS}
          />
        </Field>
        {character.imageUrl && (
          <div className="rounded overflow-hidden border border-border">
            <img
              src={character.imageUrl}
              alt={character.name}
              className="w-full h-auto max-h-[200px] object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
      </Section>

      {/* ── 외양 & 말투 ── */}
      <Section title="외양 & 말투" icon={<Eye className="w-3.5 h-3.5 text-amber-400" />} defaultOpen={false}>
        <Field label="외양 묘사" icon={<Eye className="w-3 h-3" />}>
          <AutoField
            value={character.appearance}
            onChange={(v) => update({ appearance: v })}
            placeholder="키, 체형, 머리색, 특징적인 외모 요소..."
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="말투와 목소리" icon={<Mic className="w-3 h-3" />}>
          <AutoField
            value={character.speechPattern}
            onChange={(v) => update({ speechPattern: v })}
            placeholder="어미, 말버릇, 목소리 톤, 화법 특징..."
            className={TEXTAREA_CLASS}
          />
        </Field>
      </Section>

      {/* ── 아이템 & 습관 ── */}
      <Section title="아이템 & 습관" icon={<Gem className="w-3.5 h-3.5 text-emerald-400" />} defaultOpen={false}>
        <Field label="시그니처 아이템" icon={<Gem className="w-3 h-3" />}>
          <input
            type="text"
            value={character.signatureItem}
            onChange={(e) => update({ signatureItem: e.target.value })}
            placeholder="항상 소지하는 물건, 상징적 아이템..."
            className={INPUT_CLASS}
          />
        </Field>
        <Field label="습관, 매너리즘" icon={<Repeat className="w-3 h-3" />}>
          <AutoField
            value={character.habits}
            onChange={(v) => update({ habits: v })}
            placeholder="반복적인 행동, 무의식적 버릇..."
            className={TEXTAREA_CLASS}
          />
        </Field>
      </Section>

      {/* ── 동기 ── */}
      <Section title="동기" icon={<Heart className="w-3.5 h-3.5 text-red-400" />} defaultOpen={true}>
        <Field label="욕망 (Desire)" icon={<Heart className="w-3 h-3" />}>
          <AutoField
            value={character.desire}
            onChange={(v) => update({ desire: v })}
            placeholder="이 캐릭터가 가장 원하는 것은..."
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="결핍 (Deficiency)" icon={<ShieldAlert className="w-3 h-3" />}>
          <AutoField
            value={character.deficiency}
            onChange={(v) => update({ deficiency: v })}
            placeholder="무엇이 부족한가, 어떤 약점이 있는가..."
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="두려움 (Fear)" icon={<Skull className="w-3 h-3" />}>
          <AutoField
            value={character.fear}
            onChange={(v) => update({ fear: v })}
            placeholder="가장 두려워하는 것..."
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="비밀 (Secret)" icon={<KeyRound className="w-3 h-3" />}>
          <AutoField
            value={character.secret}
            onChange={(v) => update({ secret: v })}
            placeholder="아무도 모르는 비밀..."
            className={TEXTAREA_CLASS}
          />
        </Field>
        <Field label="가치관 (Values)" icon={<Scale className="w-3 h-3" />}>
          <AutoField
            value={character.values}
            onChange={(v) => update({ values: v })}
            placeholder="삶에서 가장 중요하게 여기는 것..."
            className={TEXTAREA_CLASS}
          />
        </Field>
      </Section>
    </div>
  )
}
