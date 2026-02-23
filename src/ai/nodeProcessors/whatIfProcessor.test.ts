/**
 * Unit tests for What-If Branch Processor.
 * Tests: valid JSON parsing, non-JSON fallback split, no provider error, message construction.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callWithTools } from '../providers'
import { processWhatIf } from './whatIfProcessor'

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

describe('processWhatIf', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses valid JSON response into branchA and branchB', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify({ branchA: 'A story', branchB: 'B story' }),
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processWhatIf('current scene text', 'some context')

    expect(result).toEqual({ branchA: 'A story', branchB: 'B story' })
  })

  it('splits non-JSON response in half as fallback', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'abcdef',
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processWhatIf('scene', '')

    expect(result.branchA).toBe('abc')
    expect(result.branchB).toBe('def')
  })

  it('handles JSON with missing fields by defaulting to empty strings', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify({ branchA: 'only A' }),
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processWhatIf('scene', '')

    expect(result.branchA).toBe('only A')
    expect(result.branchB).toBe('')
  })

  it('throws error when no AI provider is active', async () => {
    const { useAIStore } = await import('@/stores/aiStore')
    vi.mocked(useAIStore.getState).mockReturnValueOnce({
      activeProviders: [],
      configs: {},
    } as ReturnType<typeof useAIStore.getState>)

    await expect(processWhatIf('scene', 'context')).rejects.toThrow(
      '활성화된 AI 프로바이더가 없습니다.',
    )
  })

  it('passes context and scene in messages to callWithTools', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify({ branchA: 'A', branchB: 'B' }),
      toolCalls: [],
      stopReason: 'end',
    })

    await processWhatIf('my scene text', 'my context')

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
    expect(messages[1].content).toContain('my context')
    expect(messages[1].content).toContain('my scene text')
  })

  it('omits context prefix when context is empty', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify({ branchA: 'A', branchB: 'B' }),
      toolCalls: [],
      stopReason: 'end',
    })

    await processWhatIf('scene only', '')

    const [, messages] = vi.mocked(callWithTools).mock.calls[0]
    const userContent = messages[1].content as string
    expect(userContent).not.toContain('[이전 맥락]')
    expect(userContent).toContain('scene only')
  })
})
