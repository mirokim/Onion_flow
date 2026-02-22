/**
 * SettingsDialog - Application settings with tabs for General and AI Configuration.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Eye, EyeOff, Sun, Moon, MonitorSmartphone, Globe, Info } from 'lucide-react'
import { useEditorStore, type Theme, type Language } from '@/stores/editorStore'
import { useAIStore } from '@/stores/aiStore'
import type { AIProvider } from '@/types'
import { cn } from '@/lib/utils'

interface SettingsDialogProps {
  open: boolean
  onClose: () => void
}

type SettingsTab = 'general' | 'ai'

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

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({})

  const { theme, setTheme, language, setLanguage } = useEditorStore()
  const { configs, updateConfig, customModels, addCustomModel, removeCustomModel } = useAIStore()

  if (!open) return null

  const toggleKeyVisibility = (provider: string) => {
    setShowApiKeys(prev => ({ ...prev, [provider]: !prev[provider] }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-bg-surface border border-border rounded-xl shadow-2xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-sm font-bold text-text-primary">{t('settings.title', '설정')}</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border px-5 shrink-0">
          {([
            { key: 'general' as SettingsTab, label: t('settings.general', '일반') },
            { key: 'ai' as SettingsTab, label: t('settings.ai', 'AI 설정') },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-xs font-medium border-b-2 transition',
                activeTab === tab.key
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Version */}
              <div>
                <h3 className="text-xs font-semibold text-text-secondary mb-3 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  {t('settings.version', '버전')}
                </h3>
                <div className="px-4 py-3 rounded-lg border border-border bg-bg-primary">
                  <span className="text-xs text-text-primary font-mono">Onion Flow v{APP_VERSION}</span>
                </div>
              </div>

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

          {activeTab === 'ai' && (
            <div className="space-y-4">
              <p className="text-[10px] text-text-muted">
                {t('settings.aiDescription', 'Story Flow에서 AI 기능을 사용하려면 API 키를 입력하세요. 키는 로컬에만 저장됩니다.')}
              </p>

              {PROVIDER_INFO.map(({ key, label, description, defaultModels }) => {
                const config = configs[key]
                if (!config) return null
                const isVisible = showApiKeys[key] || false
                const allModels = [...defaultModels, ...(customModels[key] || [])]

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
                          <label className="block text-[10px] font-medium text-text-muted mb-1">
                            {t('settings.model', '모델')}
                          </label>
                          <select
                            value={config.model}
                            onChange={(e) => updateConfig(key, { model: e.target.value })}
                            className="w-full px-2.5 py-1.5 rounded bg-bg-surface border border-border text-text-primary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
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
  )
}
