import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { AIConfig, AIMessage, AIProvider, PromptTemplate, AIConversation } from '@/types'
import { generateId } from '@/lib/utils'
import { nowUTC } from '@/lib/dateUtils'
import { getAdapter } from '@/db/storageAdapter'

interface AIState {
  configs: Record<AIProvider, AIConfig>
  activeProviders: AIProvider[]
  tripleMode: boolean
  messages: AIMessage[]
  tripleMessages: Record<AIProvider, AIMessage[]>
  isLoading: Record<AIProvider, boolean>
  promptTemplates: PromptTemplate[]
  conversations: AIConversation[]
  currentConversationId: string | null
  contextInjection: 'always' | 'ask' | 'never'
  customModels: Record<AIProvider, string[]>

  // Config
  updateConfig: (provider: AIProvider, updates: Partial<AIConfig>) => void
  addCustomModel: (provider: AIProvider, model: string) => void
  removeCustomModel: (provider: AIProvider, model: string) => void

  // Chat
  sendMessage: (content: string, projectId?: string) => Promise<void>
  setContextInjection: (mode: 'always' | 'ask' | 'never') => void
  clearMessages: () => void
  setTripleMode: (v: boolean) => void

  // Conversations
  loadConversations: (projectId: string) => Promise<void>
  createConversation: (projectId: string, title?: string) => Promise<AIConversation>
  selectConversation: (id: string) => Promise<void>
  renameConversation: (id: string, title: string) => Promise<void>
  deleteConversation: (id: string) => Promise<void>

  // Templates
  addTemplate: (template: Omit<PromptTemplate, 'id'>) => void
  deleteTemplate: (id: string) => void
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: 'gpt-4.1',
  anthropic: 'claude-sonnet-4-5-20250929',
  gemini: 'gemini-2.5-flash',
  llama: 'meta-llama/Llama-4-Scout-17B-16E-Instruct',
  grok: 'grok-3-latest',
}

const DEFAULT_TEMPLATES: PromptTemplate[] = [
  { id: '1', name: '장면 묘사 확장', prompt: '다음 장면을 더 생생하고 감각적으로 확장해주세요. 오감을 활용하여 독자가 몰입할 수 있도록 디테일을 더해주세요:\n\n{text}', category: 'writing' },
  { id: '2', name: '대사 톤 체크', prompt: '다음 캐릭터의 대사가 성격 설정에 맞는지 분석하고 대안을 제시해주세요:\n\n{text}', category: 'character' },
  { id: '3', name: '페이싱 분석', prompt: '다음 텍스트의 페이싱을 분석해주세요. 액션/대화/묘사 비율과 긴장감 흐름을 평가해주세요:\n\n{text}', category: 'analysis' },
  { id: '4', name: '복선 제안', prompt: '현재 스토리를 기반으로 복선 아이디어 3개를 제안해주세요:\n\n{text}', category: 'writing' },
  { id: '5', name: '설정 일관성 검증', prompt: '다음 세계관 설정에 모순이나 불일치가 있는지 검증해주세요:\n\n{text}', category: 'worldbuilding' },
  { id: '6', name: '감정 곡선 분석', prompt: '다음 텍스트의 감정 곡선을 분석해주세요:\n\n{text}', category: 'analysis' },
  { id: '7', name: '클리셰 감지', prompt: '다음 텍스트에서 진부한 표현이나 클리셰를 찾아 대안을 제시해주세요:\n\n{text}', category: 'analysis' },
  { id: '8', name: '갈등 심화', prompt: '현재 장면의 갈등을 더 깊고 복잡하게 만들어주세요:\n\n{text}', category: 'writing' },
  { id: '9', name: '캐릭터 개성 강화', prompt: '다음 장면에서 캐릭터의 개성이 더 잘 드러나도록 개선해주세요:\n\n{text}', category: 'character' },
  { id: '10', name: '반전 아이디어', prompt: '현재 스토리 흐름을 바탕으로 반전 아이디어 3가지를 제안해주세요:\n\n{text}', category: 'writing' },
  { id: '11', name: '복선 등록', prompt: '현재 챕터를 읽고 발견되는 복선을 모두 데이터베이스에 등록해주세요.', category: 'action' },
  { id: '12', name: '캐릭터 등록', prompt: '현재 챕터를 읽고 새로 등장하는 캐릭터를 데이터베이스에 등록해주세요.', category: 'action' },
  { id: '13', name: '세계관 설정 등록', prompt: '현재 챕터를 읽고 새로 드러난 세계관 설정을 데이터베이스에 등록해주세요.', category: 'action' },
  { id: '14', name: '챕터 시놉시스 작성', prompt: '현재 챕터의 내용을 읽고 시놉시스를 작성하여 저장해주세요.', category: 'action' },
]

// ── Security: Obfuscate API keys in localStorage ──
const OBFUSCATION_KEY = 'onion-flow-salt-2025'

function obfuscateApiKey(key: string): string {
  if (!key) return ''
  try {
    const encoded = btoa(unescape(encodeURIComponent(key)))
    let result = ''
    for (let i = 0; i < encoded.length; i++) {
      result += String.fromCharCode(encoded.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length))
    }
    return 'enc:' + btoa(result)
  } catch {
    return key
  }
}

function deobfuscateApiKey(stored: string): string {
  if (!stored || !stored.startsWith('enc:')) return stored
  try {
    const decoded = atob(stored.slice(4))
    let result = ''
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(decoded.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length))
    }
    return decodeURIComponent(escape(atob(result)))
  } catch {
    return stored
  }
}

const secureStorage: StateStorage = {
  getItem: (name: string): string | null => {
    const raw = localStorage.getItem(name)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.state?.configs) {
        for (const provider of ['openai', 'anthropic', 'gemini', 'llama', 'grok']) {
          if (parsed.state.configs[provider]?.apiKey) {
            parsed.state.configs[provider].apiKey = deobfuscateApiKey(parsed.state.configs[provider].apiKey)
          }
        }
      }
      return JSON.stringify(parsed)
    } catch {
      return raw
    }
  },
  setItem: (name: string, value: string): void => {
    try {
      const parsed = JSON.parse(value)
      if (parsed?.state?.configs) {
        for (const provider of ['openai', 'anthropic', 'gemini', 'llama', 'grok']) {
          if (parsed.state.configs[provider]?.apiKey) {
            parsed.state.configs[provider].apiKey = obfuscateApiKey(parsed.state.configs[provider].apiKey)
          }
        }
      }
      localStorage.setItem(name, JSON.stringify(parsed))
    } catch {
      localStorage.setItem(name, value)
    }
  },
  removeItem: (name: string): void => {
    localStorage.removeItem(name)
  },
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      configs: {
        openai: { provider: 'openai', apiKey: '', model: DEFAULT_MODELS.openai, enabled: false },
        anthropic: { provider: 'anthropic', apiKey: '', model: DEFAULT_MODELS.anthropic, enabled: false },
        gemini: { provider: 'gemini', apiKey: '', model: DEFAULT_MODELS.gemini, enabled: false },
        llama: { provider: 'llama', apiKey: '', model: DEFAULT_MODELS.llama, enabled: false },
        grok: { provider: 'grok', apiKey: '', model: DEFAULT_MODELS.grok, enabled: false },
      },
      activeProviders: [] as AIProvider[],
      tripleMode: false,
      messages: [],
      tripleMessages: { openai: [], anthropic: [], gemini: [], llama: [], grok: [] },
      isLoading: { openai: false, anthropic: false, gemini: false, llama: false, grok: false },
      promptTemplates: DEFAULT_TEMPLATES,
      conversations: [],
      currentConversationId: null,
      contextInjection: 'ask' as 'always' | 'ask' | 'never',
      customModels: { openai: [], anthropic: [], gemini: [], llama: [], grok: [] } as Record<AIProvider, string[]>,

      setContextInjection: (mode) => set({ contextInjection: mode }),

      addCustomModel: (provider, model) => {
        set(s => {
          const existing = s.customModels[provider] || []
          if (existing.includes(model)) return s
          return { customModels: { ...s.customModels, [provider]: [...existing, model] } }
        })
      },

      removeCustomModel: (provider, model) => {
        set(s => ({
          customModels: { ...s.customModels, [provider]: (s.customModels[provider] || []).filter(m => m !== model) },
        }))
      },

      updateConfig: (provider, updates) => {
        set(s => {
          const newConfig = { ...s.configs[provider], ...updates }
          const newConfigs = { ...s.configs, [provider]: newConfig }
          const activeProviders = (['openai', 'anthropic', 'gemini', 'llama', 'grok'] as AIProvider[]).filter(
            p => newConfigs[p]?.enabled && (newConfigs[p]?.apiKey || newConfigs[p]?.baseUrl)
          )
          return { configs: newConfigs, activeProviders }
        })
      },

      // Placeholder: Full AI send logic will be added in Phase 6
      sendMessage: async (content, projectId) => {
        const { activeProviders } = get()
        if (activeProviders.length === 0) return

        const userMsg: AIMessage = {
          id: generateId(),
          role: 'user',
          content,
          timestamp: nowUTC(),
        }
        set(s => ({ messages: [...s.messages, userMsg] }))

        // TODO: Phase 6 - integrate with AI providers, tool calling, storyteller engine
        const provider = activeProviders[0]
        const placeholderMsg: AIMessage = {
          id: generateId(),
          role: 'assistant',
          content: '[AI 통합은 Phase 6에서 구현됩니다]',
          provider,
          timestamp: nowUTC(),
        }
        set(s => ({ messages: [...s.messages, placeholderMsg] }))
      },

      clearMessages: () => set({
        messages: [],
        tripleMessages: { openai: [], anthropic: [], gemini: [], llama: [], grok: [] },
      }),

      setTripleMode: (v) => set({ tripleMode: v }),

      // Conversations
      loadConversations: async (projectId) => {
        const convs = await getAdapter().fetchConversations(projectId)
        set({ conversations: convs })
      },

      createConversation: async (projectId, title) => {
        const conv: AIConversation = {
          id: generateId(),
          projectId,
          title: title || '새 대화',
          messages: [],
          createdAt: nowUTC(),
        }
        await getAdapter().insertConversation(conv)
        set(s => ({
          conversations: [conv, ...s.conversations],
          currentConversationId: conv.id,
          messages: [],
        }))
        return conv
      },

      selectConversation: async (id) => {
        const msgs = await getAdapter().fetchMessages(id)
        set({ currentConversationId: id, messages: msgs as AIMessage[] })
      },

      renameConversation: async (id, title) => {
        await getAdapter().updateConversation(id, { title })
        set(s => ({
          conversations: s.conversations.map(c => c.id === id ? { ...c, title } : c),
        }))
      },

      deleteConversation: async (id) => {
        await getAdapter().deleteConversation(id)
        set(s => ({
          conversations: s.conversations.filter(c => c.id !== id),
          currentConversationId: s.currentConversationId === id ? null : s.currentConversationId,
          messages: s.currentConversationId === id ? [] : s.messages,
        }))
      },

      addTemplate: (template) => {
        const t = { ...template, id: generateId() }
        set(s => ({ promptTemplates: [...s.promptTemplates, t] }))
      },

      deleteTemplate: (id) => {
        set(s => ({ promptTemplates: s.promptTemplates.filter(t => t.id !== id) }))
      },
    }),
    {
      name: 'onion-flow-ai-config',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        configs: state.configs,
        promptTemplates: state.promptTemplates,
        tripleMode: state.tripleMode,
        contextInjection: state.contextInjection,
        customModels: state.customModels,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          if (!state.configs.llama) {
            state.configs.llama = { provider: 'llama', apiKey: '', model: DEFAULT_MODELS.llama, enabled: false }
          }
          if (!state.configs.grok) {
            state.configs.grok = { provider: 'grok', apiKey: '', model: DEFAULT_MODELS.grok, enabled: false }
          }
          if (state.promptTemplates) {
            const existingIds = new Set(state.promptTemplates.map(t => t.id))
            const newDefaults = DEFAULT_TEMPLATES.filter(t => !existingIds.has(t.id))
            if (newDefaults.length > 0) {
              state.promptTemplates = [...state.promptTemplates, ...newDefaults]
            }
          }
          state.activeProviders = (['openai', 'anthropic', 'gemini', 'llama', 'grok'] as AIProvider[]).filter(
            p => state.configs[p]?.enabled && (state.configs[p]?.apiKey || state.configs[p]?.baseUrl)
          )
        }
      },
    }
  )
)
