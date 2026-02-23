/**
 * Unit tests for Show, Don't Tell Processor.
 * Tests: returns AI response content, no provider error, input text in messages.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callWithTools } from '../providers'
import { processShowDontTell } from './showDontTellProcessor'

vi.mock('../providers', () => ({
  callWithTools: vi.fn(),
}))

vi.mock('@/stores/aiStore', () => ({
  useAIStore: {
    getState: vi.fn(() => ({
      activeProviders: ['openai'],
      configs: {
        openai: { provider: 'openai', model: 'gpt-4', apiKey: 'test', enabled: true },
      },
    })),
  },
}))

describe('processShowDontTell', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns AI response content directly', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'The rain drummed against the windowpane...',
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processShowDontTell('It was raining and she was sad.')

    expect(result).toBe('The rain drummed against the windowpane...')
  })

  it('throws error when no AI provider is active', async () => {
    const { useAIStore } = await import('@/stores/aiStore')
    vi.mocked(useAIStore.getState).mockReturnValueOnce({
      activeProviders: [],
      configs: {},
    } as ReturnType<typeof useAIStore.getState>)

    await expect(processShowDontTell('some text')).rejects.toThrow(
      '활성화된 AI 프로바이더가 없습니다.',
    )
  })

  it('passes input text as user message to callWithTools', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'enhanced text',
      toolCalls: [],
      stopReason: 'end',
    })

    await processShowDontTell('그녀는 슬펐다.')

    expect(callWithTools).toHaveBeenCalledTimes(1)
    const [config, messages, useTools] = vi.mocked(callWithTools).mock.calls[0]

    expect(config).toEqual({
      provider: 'openai',
      model: 'gpt-4',
      apiKey: 'test',
      enabled: true,
    })
    expect(useTools).toBe(false)
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[1].role).toBe('user')
    expect(messages[1].content).toBe('그녀는 슬펐다.')
  })

  it('returns empty string when AI responds with empty content', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: '',
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processShowDontTell('input')

    expect(result).toBe('')
  })
})
