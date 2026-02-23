import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'
import type { AIConfig, AIMessage, AIProvider, AIToolCall, AIToolResult, PromptTemplate, AIConversation } from '@/types'
import { generateId } from '@/lib/utils'
import { nowUTC } from '@/lib/dateUtils'
import { getAdapter } from '@/db/storageAdapter'
import { callWithTools, buildToolResultMessages, type ProviderResponse } from '@/ai/providers'
import { executeTool } from '@/ai/toolExecutor'
import { buildChatSystemPrompt } from '@/ai/chatSystemPrompt'

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

// ── Security: API key encryption ──
// Electron: OS-level encryption via safeStorage (DPAPI on Windows, Keychain on macOS)
// Web fallback: XOR obfuscation (better than plaintext but not truly secure)

const PROVIDERS = ['openai', 'anthropic', 'gemini', 'llama', 'grok'] as const
const OBFUSCATION_KEY = 'onion-flow-salt-2025'

/** Pending encrypt/decrypt promises from Electron safeStorage */
let _safeStorageReady: boolean | null = null

async function isSafeStorageAvailable(): Promise<boolean> {
  if (_safeStorageReady !== null) return _safeStorageReady
  if (!window.electronAPI?.safeStorageAvailable) {
    _safeStorageReady = false
    return false
  }
  _safeStorageReady = await window.electronAPI.safeStorageAvailable()
  return _safeStorageReady
}

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

/**
 * Encrypt API keys using Electron safeStorage (if available).
 * Called asynchronously after setItem writes the obfuscated fallback.
 */
async function encryptApiKeysAsync(name: string): Promise<void> {
  if (!await isSafeStorageAvailable()) return
  const raw = localStorage.getItem(name)
  if (!raw) return
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.state?.configs) return
    let changed = false
    for (const provider of PROVIDERS) {
      const apiKey = parsed.state.configs[provider]?.apiKey
      if (apiKey && !apiKey.startsWith('safe:')) {
        // Deobfuscate first if already obfuscated, to get plaintext
        const plain = apiKey.startsWith('enc:') ? deobfuscateApiKey(apiKey) : apiKey
        const encrypted = await window.electronAPI!.safeEncrypt(plain)
        if (encrypted) {
          parsed.state.configs[provider].apiKey = 'safe:' + encrypted
          changed = true
        }
      }
    }
    if (changed) {
      localStorage.setItem(name, JSON.stringify(parsed))
    }
  } catch { /* ignore */ }
}

/**
 * Decrypt API keys from Electron safeStorage.
 * Falls back to XOR deobfuscation for 'enc:' prefixed keys.
 */
async function decryptApiKeysAsync(name: string): Promise<string | null> {
  const raw = localStorage.getItem(name)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!parsed?.state?.configs) return raw
    for (const provider of PROVIDERS) {
      const apiKey = parsed.state.configs[provider]?.apiKey
      if (!apiKey) continue
      if (apiKey.startsWith('safe:') && window.electronAPI?.safeDecrypt) {
        const decrypted = await window.electronAPI.safeDecrypt(apiKey.slice(5))
        if (decrypted) {
          parsed.state.configs[provider].apiKey = decrypted
        } else {
          parsed.state.configs[provider].apiKey = ''
        }
      } else if (apiKey.startsWith('enc:')) {
        parsed.state.configs[provider].apiKey = deobfuscateApiKey(apiKey)
      }
    }
    return JSON.stringify(parsed)
  } catch {
    return raw
  }
}

const secureStorage: StateStorage = {
  getItem: (name: string): string | null => {
    const raw = localStorage.getItem(name)
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.state?.configs) {
        for (const provider of PROVIDERS) {
          const apiKey = parsed.state.configs[provider]?.apiKey
          if (!apiKey) continue
          // safe: keys are decrypted asynchronously after init (see rehydration below)
          if (apiKey.startsWith('safe:')) {
            // Return empty temporarily; async decrypt will update state
            parsed.state.configs[provider].apiKey = ''
          } else if (apiKey.startsWith('enc:')) {
            parsed.state.configs[provider].apiKey = deobfuscateApiKey(apiKey)
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
        for (const provider of PROVIDERS) {
          if (parsed.state.configs[provider]?.apiKey) {
            // Immediately obfuscate as fallback
            parsed.state.configs[provider].apiKey = obfuscateApiKey(parsed.state.configs[provider].apiKey)
          }
        }
      }
      localStorage.setItem(name, JSON.stringify(parsed))
      // Upgrade to OS-level encryption asynchronously
      encryptApiKeysAsync(name)
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

      sendMessage: async (content, projectId) => {
        const { activeProviders, configs, tripleMode, currentConversationId } = get()
        if (activeProviders.length === 0) return

        const userMsg: AIMessage = {
          id: generateId(),
          role: 'user',
          content,
          conversationId: currentConversationId || undefined,
          timestamp: nowUTC(),
        }
        set(s => ({ messages: [...s.messages, userMsg] }))

        // Persist user message
        if (currentConversationId) {
          await getAdapter().insertMessage({ ...userMsg, conversationId: currentConversationId })
        }

        // Triple mode: send to all active providers in parallel
        if (tripleMode && activeProviders.length > 1) {
          const promises = activeProviders.map(p => sendToProvider(p, configs[p], get, set, projectId, currentConversationId))
          await Promise.allSettled(promises)
          return
        }

        // Single provider mode
        const provider = activeProviders[0]
        await sendToProvider(provider, configs[provider], get, set, projectId, currentConversationId)
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

          // Async decrypt safeStorage keys (sets state once complete)
          decryptApiKeysAsync('onion-flow-ai-config').then(decrypted => {
            if (!decrypted) return
            try {
              const parsed = JSON.parse(decrypted)
              if (parsed?.state?.configs) {
                const configs = parsed.state.configs
                const activeProviders = (['openai', 'anthropic', 'gemini', 'llama', 'grok'] as AIProvider[]).filter(
                  p => configs[p]?.enabled && (configs[p]?.apiKey || configs[p]?.baseUrl)
                )
                useAIStore.setState({ configs, activeProviders })
              }
            } catch { /* ignore */ }
          })
        }
      },
    }
  )
)

// ── Helper: Send message to a single AI provider ──

const MAX_TOOL_ITERATIONS = 10

type StoreGet = () => AIState
type StoreSet = (fn: (s: AIState) => Partial<AIState>) => void

async function sendToProvider(
  provider: AIProvider,
  config: AIConfig,
  get: StoreGet,
  set: StoreSet,
  projectId?: string,
  conversationId?: string | null,
) {
  set(s => ({ isLoading: { ...s.isLoading, [provider]: true } }))

  try {
    // Build system prompt with project context
    const systemPrompt = projectId ? buildChatSystemPrompt(projectId) : '당신은 소설 집필을 돕는 AI 어시스턴트입니다.'

    // Build API messages from conversation history
    const apiMessages: { role: string; content: string | unknown[] | null; [key: string]: unknown }[] = [
      { role: 'system', content: systemPrompt },
    ]

    for (const msg of get().messages) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        const apiMsg: Record<string, unknown> = { role: msg.role, content: msg.content }
        // Include tool calls in assistant messages for OpenAI/Llama/Grok format
        if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
          if (provider === 'openai' || provider === 'llama' || provider === 'grok') {
            apiMsg.tool_calls = msg.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
            }))
          }
        }
        apiMessages.push(apiMsg as typeof apiMessages[0])
      } else if (msg.role === 'tool' && msg.toolResults) {
        // Rebuild tool result messages
        const results = msg.toolResults.map(tr => ({ toolCallId: tr.toolCallId, result: tr.result }))
        const toolMsgs = buildToolResultMessages(provider, [], results)
        apiMessages.push(...toolMsgs)
      }
    }

    // Call AI provider
    let response: ProviderResponse = await callWithTools(config, apiMessages, true)
    let iterations = 0

    // Tool call loop
    while (response.stopReason === 'tool_use' && response.toolCalls.length > 0 && iterations < MAX_TOOL_ITERATIONS) {
      iterations++

      // Add assistant message with tool calls
      const assistantToolMsg: AIMessage = {
        id: generateId(),
        role: 'assistant',
        content: response.content || '',
        provider,
        toolCalls: response.toolCalls,
        conversationId: conversationId || undefined,
        timestamp: nowUTC(),
      }
      set(s => ({ messages: [...s.messages, assistantToolMsg] }))
      if (conversationId) {
        await getAdapter().insertMessage({ ...assistantToolMsg, conversationId })
      }

      // Execute each tool call
      const toolResults: AIToolResult[] = []
      for (const tc of response.toolCalls) {
        const result = await executeTool(tc.name, tc.arguments, projectId || '')
        toolResults.push({ toolCallId: tc.id, success: result.success, result: result.result })
      }

      // Add tool result message
      const toolResultMsg: AIMessage = {
        id: generateId(),
        role: 'tool',
        content: toolResults.map(r => `[${r.success ? '✓' : '✗'}] ${r.result}`).join('\n'),
        toolResults,
        conversationId: conversationId || undefined,
        timestamp: nowUTC(),
      }
      set(s => ({ messages: [...s.messages, toolResultMsg] }))
      if (conversationId) {
        await getAdapter().insertMessage({ ...toolResultMsg, conversationId })
      }

      // Build follow-up API messages with tool results
      const resultData = toolResults.map(r => ({ toolCallId: r.toolCallId, result: r.result }))

      // For OpenAI/Llama/Grok: include assistant message with tool_calls
      if (provider === 'openai' || provider === 'llama' || provider === 'grok') {
        apiMessages.push({
          role: 'assistant',
          content: response.content || null,
          tool_calls: response.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        })
      } else if (provider === 'anthropic') {
        // For Anthropic: include assistant content blocks
        apiMessages.push({
          role: 'assistant',
          content: [
            ...(response.content ? [{ type: 'text', text: response.content }] : []),
            ...response.toolCalls.map(tc => ({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.arguments,
            })),
          ],
        })
      } else {
        apiMessages.push({ role: 'assistant', content: response.content || '' })
      }

      const toolResultApiMsgs = buildToolResultMessages(provider, response.toolCalls, resultData)
      apiMessages.push(...toolResultApiMsgs)

      // Follow-up call
      response = await callWithTools(config, apiMessages, true)
    }

    // Final assistant message
    const finalMsg: AIMessage = {
      id: generateId(),
      role: 'assistant',
      content: response.content || '(응답 없음)',
      provider,
      conversationId: conversationId || undefined,
      timestamp: nowUTC(),
    }
    set(s => {
      const newMessages = [...s.messages, finalMsg]
      const tripleUpdate = s.tripleMode
        ? { tripleMessages: { ...s.tripleMessages, [provider]: [...(s.tripleMessages[provider] || []), finalMsg] } }
        : {}
      return { messages: newMessages, ...tripleUpdate }
    })
    if (conversationId) {
      await getAdapter().insertMessage({ ...finalMsg, conversationId })
    }
  } catch (err: unknown) {
    const errorContent = err instanceof Error ? err.message : String(err)
    const errorMsg: AIMessage = {
      id: generateId(),
      role: 'assistant',
      content: `⚠️ 오류: ${errorContent}`,
      provider,
      conversationId: conversationId || undefined,
      timestamp: nowUTC(),
    }
    set(s => ({ messages: [...s.messages, errorMsg] }))
    if (conversationId) {
      await getAdapter().insertMessage({ ...errorMsg, conversationId })
    }
  } finally {
    set(s => ({ isLoading: { ...s.isLoading, [provider]: false } }))
  }
}
