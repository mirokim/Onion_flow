/**
 * SettingsDialog - Unified Obsidian-style settings panel.
 * Left sidebar navigation + right content area.
 * Combines tools (Stats, Timeline, Export, Trash) and settings (General, AI, Shortcuts, About).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  X, Eye, EyeOff, Sun, Moon, MonitorSmartphone, Globe, Info,
  BarChart3, History, Download, Trash2, Settings, Cpu, Swords,
  Keyboard, RotateCcw, ExternalLink, Heart,
} from 'lucide-react'
import { useEditorStore, type Theme, type Language } from '@/stores/editorStore'
import { useAIStore } from '@/stores/aiStore'
import type { AIProvider } from '@/types'
import { cn } from '@/lib/utils'
import { StatsContent } from '@/components/stats/StatsPopup'
import { ExportContent } from '@/components/stats/ExportPopup'
import { TimelineContent } from '@/components/version/TimelinePanel'
import { TrashContent } from '@/components/common/TrashPanel'
import { DebateSettingsContent } from '@/components/ai/debate/DebateSettingsContent'
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_CATEGORIES,
  resolveKeybinding,
  formatKeyComboForDisplay,
  eventToKeyCombo,
} from '@/lib/shortcuts'

export type SettingsSection = 'stats' | 'timeline' | 'export' | 'trash' | 'general' | 'ai' | 'debate' | 'shortcuts' | 'about'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
  initialSection?: SettingsSection
}

const PROVIDER_INFO: { key: AIProvider; label: string; description: string; defaultModels: string[] }[] = [
  {
    key: 'anthropic',
    label: 'Claude (Anthropic)',
    description: 'Claude API',
    defaultModels: ['claude-sonnet-4-5-20250929', 'claude-opus-4-20250514', 'claude-haiku-3-5-20241022'],
  },
  {
    key: 'openai',
    label: 'GPT (OpenAI)',
    description: 'OpenAI API',
    defaultModels: ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o4-mini'],
  },
  {
    key: 'gemini',
    label: 'Gemini (Google)',
    description: 'Google AI API',
    defaultModels: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
  },
  {
    key: 'grok',
    label: 'Grok (xAI)',
    description: 'xAI API',
    defaultModels: ['grok-3-latest', 'grok-3-mini-latest'],
  },
  {
    key: 'llama',
    label: 'Llama (Together / Local)',
    description: 'Together AI or local LLM',
    defaultModels: ['meta-llama/Llama-4-Scout-17B-16E-Instruct', 'meta-llama/Llama-4-Maverick-17B-128E-Instruct'],
  },
]

const THEME_OPTIONS: { key: Theme; label: string; labelKo: string; icon: typeof Sun }[] = [
  { key: 'light', label: 'Light', labelKo: '라이트', icon: Sun },
  { key: 'dark', label: 'Dark', labelKo: '다크', icon: Moon },
  { key: 'black', label: 'OLED Black', labelKo: 'OLED 블랙', icon: MonitorSmartphone },
]

const LANGUAGE_OPTIONS: { key: Language; label: string; flag: string }[] = [
  { key: 'ko', label: '한국어', flag: '🇰🇷' },
  { key: 'en', label: 'English', flag: '🇺🇸' },
]

const APP_VERSION = '0.1.0'

interface SidebarItem {
  id: SettingsSection
  labelKo: string
  icon: React.ComponentType<{ className?: string }>
}

const TOOL_SECTIONS: SidebarItem[] = [
  { id: 'stats', labelKo: '통계', icon: BarChart3 },
  { id: 'timeline', labelKo: '타임라인', icon: History },
  { id: 'export', labelKo: '내보내기', icon: Download },
  { id: 'trash', labelKo: '휴지통', icon: Trash2 },
]

const SETTINGS_SECTIONS: SidebarItem[] = [
  { id: 'general', labelKo: '일반', icon: Settings },
  { id: 'ai', labelKo: 'AI 설정', icon: Cpu },
  { id: 'debate', labelKo: '토론', icon: Swords },
  { id: 'shortcuts', labelKo: '단축키', icon: Keyboard },
]

const OTHER_SECTIONS: SidebarItem[] = [
  { id: 'about', labelKo: '정보', icon: Info },
]

const ALL_SECTIONS: SidebarItem[] = [...TOOL_SECTIONS, ...SETTINGS_SECTIONS, ...OTHER_SECTIONS]

// ── Keyboard Shortcut Recording Sub-component ──
function ShortcutsContent() {
  const { language, customKeybindings, setKeybinding, resetKeybinding, resetAllKeybindings } = useEditorStore()
  const [recordingId, setRecordingId] = useState<string | null>(null)

  const handleRecord = useCallback((e: KeyboardEvent) => {
    if (!recordingId) return

    // Ignore bare modifier keys
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return

    e.preventDefault()
    e.stopPropagation()

    // Escape cancels recording
    if (e.key === 'Escape') {
      setRecordingId(null)
      return
    }

    const combo = eventToKeyCombo(e)
    if (combo) {
      setKeybinding(recordingId, combo)
      setRecordingId(null)
    }
  }, [recordingId, setKeybinding])

  useEffect(() => {
    if (recordingId) {
      window.addEventListener('keydown', handleRecord, true)
      return () => window.removeEventListener('keydown', handleRecord, true)
    }
  }, [recordingId, handleRecord])

  const isKo = language === 'ko'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-text-muted">
          {isKo
            ? '단축키를 클릭하면 새 키 조합을 녹음할 수 있습니다. Esc로 취소합니다.'
            : 'Click a shortcut to record a new key combination. Press Esc to cancel.'}
        </p>
        <button
          onClick={resetAllKeybindings}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary rounded border border-border hover:border-text-muted transition"
        >
          <RotateCcw className="w-3 h-3" />
          {isKo ? '전체 초기화' : 'Reset All'}
        </button>
      </div>

      {SHORTCUT_CATEGORIES.map(cat => {
        const shortcuts = DEFAULT_SHORTCUTS.filter(s => s.category === cat.key)
        if (shortcuts.length === 0) return null

        return (
          <div key={cat.key}>
            <h4 className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-2">
              {isKo ? cat.labelKo : cat.labelEn}
            </h4>
            <div className="rounded-lg border border-border bg-bg-primary overflow-hidden">
              {shortcuts.map((shortcut, i) => {
                const effectiveKeys = resolveKeybinding(shortcut.id, customKeybindings)
                const isCustomized = !!customKeybindings[shortcut.id]
                const isRecording = recordingId === shortcut.id
                const keyParts = formatKeyComboForDisplay(effectiveKeys)

                return (
                  <div
                    key={shortcut.id}
                    className={cn(
                      'flex items-center justify-between px-4 py-2.5',
                      i > 0 && 'border-t border-border/50',
                    )}
                  >
                    {/* Action name */}
                    <span className="text-xs text-text-primary">
                      {isKo ? shortcut.labelKo : shortcut.labelEn}
                    </span>

                    <div className="flex items-center gap-2">
                      {/* Kbd badges — clickable to start recording */}
                      <button
                        onClick={() => setRecordingId(isRecording ? null : shortcut.id)}
                        className={cn(
                          'flex items-center gap-1 px-2 py-1 rounded transition',
                          isRecording
                            ? 'ring-2 ring-accent animate-pulse bg-accent/10'
                            : 'hover:bg-bg-hover',
                        )}
                        title={isKo ? '클릭하여 변경' : 'Click to change'}
                      >
                        {isRecording ? (
                          <span className="text-[10px] text-accent font-medium">
                            {isKo ? '키 입력 대기...' : 'Press keys...'}
                          </span>
                        ) : (
                          keyParts.map((part, pi) => (
                            <kbd
                              key={pi}
                              className={cn(
                                'inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5',
                                'text-[10px] font-mono font-medium rounded border shadow-sm',
                                isCustomized
                                  ? 'bg-accent/10 border-accent/30 text-accent'
                                  : 'bg-bg-surface border-border text-text-secondary',
                              )}
                            >
                              {part}
                            </kbd>
                          ))
                        )}
                      </button>

                      {/* Reset button (only show if customized) */}
                      {isCustomized && (
                        <button
                          onClick={() => resetKeybinding(shortcut.id)}
                          className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-hover transition"
                          title={isKo ? '기본값으로 초기화' : 'Reset to default'}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── About Section Sub-component ──
function AboutContent() {
  const { language } = useEditorStore()
  const isKo = language === 'ko'

  return (
    <div className="space-y-6">
      {/* App Identity */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
          <span className="text-2xl">🧅</span>
        </div>
        <div>
          <h3 className="text-base font-bold text-text-primary">Onion Flow</h3>
          <p className="text-xs text-text-muted font-mono">v{APP_VERSION}</p>
          <p className="text-[10px] text-text-secondary mt-0.5">
            {isKo
              ? '노드 기반 비주얼 노벨 스토리 디자인 IDE'
              : 'Visual Novel Writing IDE with Node-based Story Design'}
          </p>
        </div>
      </div>

      {/* Author */}
      <div className="rounded-lg border border-border bg-bg-primary p-4 space-y-3">
        <h4 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
          <Heart className="w-3.5 h-3.5" />
          {isKo ? '제작자' : 'Author'}
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-primary font-medium">mirokim</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-text-muted">miro85a@gmail.com</span>
          </div>
        </div>
      </div>

      {/* Source & Links */}
      <div className="rounded-lg border border-border bg-bg-primary p-4 space-y-3">
        <h4 className="text-xs font-semibold text-text-secondary flex items-center gap-1.5">
          <ExternalLink className="w-3.5 h-3.5" />
          {isKo ? '소스 코드' : 'Source Code'}
        </h4>
        <a
          href="https://github.com/mirokim/Onion_flow"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-xs text-accent hover:underline"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          github.com/mirokim/Onion_flow
        </a>
      </div>

      {/* Copyright & Tech */}
      <div className="rounded-lg border border-border bg-bg-primary p-4 space-y-3">
        <h4 className="text-xs font-semibold text-text-secondary">
          {isKo ? '기술 스택' : 'Built With'}
        </h4>
        <div className="flex flex-wrap gap-1.5">
          {['React', 'TypeScript', 'Vite', 'Zustand', 'ReactFlow', 'TipTap', 'Tailwind CSS'].map(tech => (
            <span
              key={tech}
              className="px-2 py-0.5 text-[10px] font-mono rounded-full bg-bg-surface border border-border text-text-muted"
            >
              {tech}
            </span>
          ))}
        </div>
        <p className="text-[10px] text-text-muted pt-1">
          &copy; 2026 mirokim. All rights reserved.
        </p>
      </div>
    </div>
  )
}

// ── Main Settings Dialog ──
export function SettingsDialog({ open, onClose, initialSection }: SettingsDialogProps) {
  const { t } = useTranslation()
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection || 'general')
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})

  const { theme, setTheme, language, setLanguage } = useEditorStore()
  const { configs, updateConfig, customModels, fetchedModels, modelsFetching, fetchAllEnabledModels } = useAIStore()

  // Sync initialSection when dialog opens
  useEffect(() => {
    if (open && initialSection) {
      setActiveSection(initialSection)
    }
  }, [open, initialSection])

  // Auto-fetch models when AI section is selected
  useEffect(() => {
    if (open && activeSection === 'ai') {
      fetchAllEnabledModels()
    }
  }, [open, activeSection, fetchAllEnabledModels])

  if (!open) return null

  const toggleKeyVisibility = (provider: string) => {
    setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }))
  }

  const renderSidebarGroup = (items: SidebarItem[], label: string) => (
    <div>
      <div className="text-[10px] font-medium text-text-muted uppercase tracking-wider px-3 mb-1">{label}</div>
      {items.map(item => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={cn(
              'flex items-center gap-2.5 w-full px-3 py-2 text-xs rounded-lg transition',
              activeSection === item.id
                ? 'bg-accent/15 text-accent font-medium'
                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            <Icon className="w-4 h-4" />
            {item.labelKo}
          </button>
        )
      })}
    </div>
  )

  const sectionTitle = ALL_SECTIONS.find(s => s.id === activeSection)?.labelKo || ''

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-surface border border-border rounded-xl shadow-2xl w-[720px] h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-text-primary">{t('settings.title', '설정')}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: sidebar + content */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Sidebar */}
          <div className="w-[180px] shrink-0 border-r border-border bg-bg-primary p-3 space-y-4 overflow-y-auto">
            {renderSidebarGroup(TOOL_SECTIONS, '도구')}
            <div className="border-t border-border mx-2" />
            {renderSidebarGroup(SETTINGS_SECTIONS, '설정')}
            <div className="border-t border-border mx-2" />
            {renderSidebarGroup(OTHER_SECTIONS, '기타')}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-5 min-h-0">
            <h3 className="text-sm font-semibold text-text-primary mb-4">{sectionTitle}</h3>

            {activeSection === 'stats' && <StatsContent />}
            {activeSection === 'timeline' && <TimelineContent />}
            {activeSection === 'export' && <ExportContent />}
            {activeSection === 'trash' && <TrashContent />}

            {activeSection === 'general' && (
              <div className="space-y-6">
                {/* Language */}
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    {t('settings.language', '언어')}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {LANGUAGE_OPTIONS.map(({ key, label, flag }) => (
                      <button
                        key={key}
                        onClick={() => setLanguage(key)}
                        className={cn(
                          'flex items-center gap-2 px-4 py-3 rounded-lg border transition',
                          language === key
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-bg-primary text-text-muted hover:border-text-muted',
                        )}
                      >
                        <span className="text-base">{flag}</span>
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Theme */}
                <div>
                  <h3 className="text-xs font-semibold text-text-secondary mb-3">
                    {t('settings.theme', '테마')}
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {THEME_OPTIONS.map(({ key, label, labelKo, icon: Icon }) => (
                      <button
                        key={key}
                        onClick={() => setTheme(key)}
                        className={cn(
                          'flex flex-col items-center gap-2 px-4 py-3 rounded-lg border transition',
                          theme === key
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border bg-bg-primary text-text-muted hover:border-text-muted',
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs font-medium">{language === 'ko' ? labelKo : label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'debate' && <DebateSettingsContent />}

            {activeSection === 'shortcuts' && <ShortcutsContent />}

            {activeSection === 'about' && <AboutContent />}

            {activeSection === 'ai' && (
              <div className="space-y-4">
                <p className="text-[10px] text-text-muted">
                  {t('settings.aiDescription', 'Story Flow에서 AI 기능을 사용하려면 API 키를 입력하세요. 키는 로컬에만 저장됩니다.')}
                </p>

                {PROVIDER_INFO.map(({ key, label, description, defaultModels }) => {
                  const config = configs[key]
                  if (!config) return null
                  const isVisible = showApiKeys[key] || false
                  const isFetching = modelsFetching[key] || false
                  const fetched = fetchedModels[key] || []
                  // Use fetched models if available, otherwise fall back to defaults
                  const apiModels = fetched.length > 0 ? fetched : defaultModels
                  // Merge with custom models, deduplicate
                  const customList = customModels[key] || []
                  const allModels = [...new Set([...apiModels, ...customList])]
                  // Ensure current model is in the list even if not returned by API
                  if (config.model && !allModels.includes(config.model)) {
                    allModels.unshift(config.model)
                  }

                  return (
                    <div key={key} className="rounded-lg border border-border bg-bg-primary p-4 space-y-3">
                      {/* Header with toggle */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-text-primary">{label}</h4>
                          <p className="text-[10px] text-text-muted">{description}</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.enabled}
                            onChange={(e) => updateConfig(key, { enabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-bg-hover rounded-full peer peer-checked:bg-accent transition-colors after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                        </label>
                      </div>

                      {config.enabled && (
                        <>
                          {/* API Key */}
                          <div>
                            <label className="block text-[10px] font-medium text-text-muted mb-1">API Key</label>
                            <div className="flex items-center gap-1">
                              <input
                                type={isVisible ? 'text' : 'password'}
                                value={config.apiKey}
                                onChange={(e) => updateConfig(key, { apiKey: e.target.value })}
                                placeholder="sk-..."
                                className="flex-1 px-2.5 py-1.5 rounded bg-bg-surface border border-border text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                              />
                              <button
                                onClick={() => toggleKeyVisibility(key)}
                                className="p-1.5 rounded hover:bg-bg-hover text-text-muted transition"
                                title={isVisible ? '숨기기' : '보기'}
                              >
                                {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Model selector */}
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-medium text-text-muted">
                                {t('settings.model', '모델')}
                              </label>
                              <div className="flex items-center gap-1">
                                {isFetching && (
                                  <span className="text-[10px] text-text-muted animate-pulse">불러오는 중...</span>
                                )}
                                {fetched.length > 0 && !isFetching && (
                                  <span className="text-[10px] text-green-400">{fetched.length}개 모델</span>
                                )}
                              </div>
                            </div>
                            <select
                              value={config.model}
                              onChange={(e) => updateConfig(key, { model: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded bg-bg-surface border border-border text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                              disabled={isFetching}
                            >
                              {allModels.map(m => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          </div>

                          {/* Base URL (optional, for llama/grok) */}
                          {(key === 'llama' || key === 'grok') && (
                            <div>
                              <label className="block text-[10px] font-medium text-text-muted mb-1">
                                Base URL ({t('settings.optional', '선택사항')})
                              </label>
                              <input
                                type="text"
                                value={config.baseUrl || ''}
                                onChange={(e) => updateConfig(key, { baseUrl: e.target.value || undefined })}
                                placeholder={key === 'grok' ? 'https://api.x.ai/v1' : 'https://api.together.xyz/v1'}
                                className="w-full px-2.5 py-1.5 rounded bg-bg-surface border border-border text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
