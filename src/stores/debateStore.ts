/**
 * Debate store — manages debate/discussion state.
 * Ported from Onion Ring's debateStore.ts.
 * Uses aiStore.configs for provider settings instead of a separate settingsStore.
 */
import { create } from 'zustand'
import type {
  AIProvider,
  AIConfig,
  DiscussionConfig,
  DiscussionMessage,
  DebateStatus,
  ReferenceFile,
} from '@/types'
import { generateId } from '@/lib/utils'
import { runDebate } from '@/ai/debateEngine'
import { useAIStore } from './aiStore'

interface DebateState {
  status: DebateStatus
  config: DiscussionConfig | null
  messages: DiscussionMessage[]
  currentRound: number
  currentTurnIndex: number
  loadingProvider: AIProvider | null
  abortController: AbortController | null

  // Pacing state
  countdown: number // >0 = auto countdown seconds, -1 = manual waiting, 0 = none
  waitingForNext: boolean
  _nextTurnResolver: (() => void) | null

  // Actions
  startDebate: (config: DiscussionConfig) => void
  pauseDebate: () => void
  resumeDebate: () => void
  stopDebate: () => void
  userIntervene: (content: string, files?: ReferenceFile[]) => void
  nextTurn: () => void
  reset: () => void
}

export const useDebateStore = create<DebateState>()((set, get) => ({
  status: 'idle',
  config: null,
  messages: [],
  currentRound: 0,
  currentTurnIndex: 0,
  loadingProvider: null,
  abortController: null,
  countdown: 0,
  waitingForNext: false,
  _nextTurnResolver: null,

  startDebate: (config) => {
    // Abort any previous debate
    const prev = get().abortController
    if (prev) prev.abort()

    const controller = new AbortController()

    set({
      config,
      status: 'running',
      messages: [],
      currentRound: 1,
      currentTurnIndex: 0,
      loadingProvider: null,
      abortController: controller,
      countdown: 0,
      waitingForNext: false,
      _nextTurnResolver: null,
    })

    // Get provider configs from aiStore
    const { configs } = useAIStore.getState()
    const providerConfigs: Record<string, AIConfig> = {} as Record<string, AIConfig>
    for (const [key, value] of Object.entries(configs)) {
      providerConfigs[key] = value
    }

    // Launch the debate engine (fire-and-forget, updates come via callbacks)
    void runDebate(
      config,
      providerConfigs,
      {
        onMessage: (msg) => {
          set((state) => ({ messages: [...state.messages, msg] }))
        },
        onStatusChange: (status) => {
          set({ status })
        },
        onRoundChange: (round, turnIndex) => {
          set({ currentRound: round, currentTurnIndex: turnIndex })
        },
        onLoadingChange: (provider) => {
          set({ loadingProvider: provider })
        },
        onCountdownTick: (seconds) => {
          set({ countdown: seconds, waitingForNext: seconds === -1 })
        },
        waitForNextTurn: () =>
          new Promise<void>((resolve) => {
            set({ _nextTurnResolver: resolve, waitingForNext: true })
          }),
        getStatus: () => get().status,
        getMessages: () => get().messages,
      },
      controller.signal,
    )
  },

  pauseDebate: () => set({ status: 'paused' }),

  resumeDebate: () => set({ status: 'running' }),

  stopDebate: () => {
    // Resolve pending manual turn if any
    const resolver = get()._nextTurnResolver
    if (resolver) resolver()
    get().abortController?.abort()
    set({
      status: 'stopped',
      loadingProvider: null,
      countdown: 0,
      waitingForNext: false,
      _nextTurnResolver: null,
    })
  },

  userIntervene: (content, files) => {
    const msg: DiscussionMessage = {
      id: generateId(),
      provider: 'user',
      content,
      round: get().currentRound,
      timestamp: Date.now(),
      files: files && files.length > 0 ? files : undefined,
    }
    set((state) => ({ messages: [...state.messages, msg] }))
  },

  nextTurn: () => {
    const resolver = get()._nextTurnResolver
    if (resolver) {
      resolver()
      set({ _nextTurnResolver: null, waitingForNext: false, countdown: 0 })
    }
  },

  reset: () => {
    // Resolve pending manual turn if any
    const resolver = get()._nextTurnResolver
    if (resolver) resolver()
    get().abortController?.abort()
    set({
      status: 'idle',
      config: null,
      messages: [],
      currentRound: 0,
      currentTurnIndex: 0,
      loadingProvider: null,
      abortController: null,
      countdown: 0,
      waitingForNext: false,
      _nextTurnResolver: null,
    })
  },
}))
