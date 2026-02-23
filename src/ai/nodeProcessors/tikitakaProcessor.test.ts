/**
 * Unit tests for Tikitaka Dialogue Processor.
 * Tests: returns dialogue text, <2 characters error, no provider error, character descriptions in system message.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callWithTools } from '../providers'
import { processTikitaka } from './tikitakaProcessor'

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

vi.mock('@/stores/worldStore', () => ({
  useWorldStore: {
    getState: vi.fn(() => ({
      characters: [
        { id: 'c1', name: 'Alice', personality: 'brave', speechPattern: '반말' },
        { id: 'c2', name: 'Bob', personality: 'timid', speechPattern: '존댓말' },
        { id: 'c3', name: 'Carol', personality: 'sarcastic', speechPattern: '' },
      ],
    })),
  },
}))

describe('processTikitaka', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns dialogue text from AI', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'Alice: 가자!\nBob: 네, 알겠습니다.',
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processTikitaka(['c1', 'c2'], 'adventure', 'forest context')

    expect(result).toBe('Alice: 가자!\nBob: 네, 알겠습니다.')
  })

  it('throws error when less than 2 characters are found', async () => {
    await expect(
      processTikitaka(['c1', 'nonexistent'], 'topic', 'context'),
    ).rejects.toThrow('최소 2명의 캐릭터가 필요합니다.')
  })

  it('throws error when only 1 valid character ID is provided', async () => {
    await expect(
      processTikitaka(['c1'], 'topic', 'context'),
    ).rejects.toThrow('최소 2명의 캐릭터가 필요합니다.')
  })

  it('throws error when no AI provider is active', async () => {
    const { useAIStore } = await import('@/stores/aiStore')
    vi.mocked(useAIStore.getState).mockReturnValueOnce({
      activeProviders: [],
      configs: {},
    } as ReturnType<typeof useAIStore.getState>)

    await expect(
      processTikitaka(['c1', 'c2'], 'topic', 'context'),
    ).rejects.toThrow('활성화된 AI 프로바이더가 없습니다.')
  })

  it('includes character descriptions in system message', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'dialogue',
      toolCalls: [],
      stopReason: 'end',
    })

    await processTikitaka(['c1', 'c2'], 'topic', 'context')

    const [, messages] = vi.mocked(callWithTools).mock.calls[0]
    const systemContent = messages[0].content as string
    expect(systemContent).toContain('Alice')
    expect(systemContent).toContain('brave')
    expect(systemContent).toContain('반말')
    expect(systemContent).toContain('Bob')
    expect(systemContent).toContain('timid')
    expect(systemContent).toContain('존댓말')
  })

  it('passes topic and context in user message', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'dialogue',
      toolCalls: [],
      stopReason: 'end',
    })

    await processTikitaka(['c1', 'c2'], 'the topic', 'the context')

    const [, messages] = vi.mocked(callWithTools).mock.calls[0]
    const userContent = messages[1].content as string
    expect(userContent).toContain('the topic')
    expect(userContent).toContain('the context')
  })

  it('omits context prefix when context is empty', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'dialogue',
      toolCalls: [],
      stopReason: 'end',
    })

    await processTikitaka(['c1', 'c2'], 'topic', '')

    const [, messages] = vi.mocked(callWithTools).mock.calls[0]
    const userContent = messages[1].content as string
    expect(userContent).not.toContain('[상황]')
    expect(userContent).toContain('topic')
  })

  it('works with 3 characters', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'three-way dialogue',
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processTikitaka(['c1', 'c2', 'c3'], 'topic', '')

    expect(result).toBe('three-way dialogue')

    const [, messages] = vi.mocked(callWithTools).mock.calls[0]
    const systemContent = messages[0].content as string
    expect(systemContent).toContain('Carol')
    expect(systemContent).toContain('sarcastic')
  })
})
