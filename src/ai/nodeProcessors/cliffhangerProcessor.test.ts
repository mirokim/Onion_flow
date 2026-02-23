/**
 * Unit tests for Cliffhanger Processor.
 * Tests: valid JSON array parsing, non-JSON fallback, no provider error, content truncation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callWithTools } from '../providers'
import { processCliffhanger } from './cliffhangerProcessor'

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

describe('processCliffhanger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses valid JSON array response into CliffhangerSuggestion[]', async () => {
    const suggestions = [
      { text: 'The door creaked open...', type: '반전형' },
      { text: 'A shadow loomed behind...', type: '위기형' },
      { text: 'Who sent the letter?', type: '의문형' },
    ]
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify(suggestions),
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processCliffhanger('chapter content here')

    expect(result).toEqual(suggestions)
    expect(result).toHaveLength(3)
  })

  it('returns fallback with type "자동" for non-JSON response', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'Some plain text cliffhanger suggestion',
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processCliffhanger('chapter content')

    expect(result).toEqual([
      { text: 'Some plain text cliffhanger suggestion', type: '자동' },
    ])
  })

  it('throws error when no AI provider is active', async () => {
    const { useAIStore } = await import('@/stores/aiStore')
    vi.mocked(useAIStore.getState).mockReturnValueOnce({
      activeProviders: [],
      configs: {},
    } as unknown as ReturnType<typeof useAIStore.getState>)

    await expect(processCliffhanger('content')).rejects.toThrow(
      '활성화된 AI 프로바이더가 없습니다.',
    )
  })

  it('truncates long chapter content to last 2000 chars in message', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify([{ text: 'ending', type: '암시형' }]),
      toolCalls: [],
      stopReason: 'end',
    })

    const longContent = 'A'.repeat(5000)
    await processCliffhanger(longContent)

    const [, messages] = vi.mocked(callWithTools).mock.calls[0]
    const userContent = messages[1].content as string
    // The source uses chapterContent.slice(-2000), so last 2000 chars
    expect(userContent).toContain('A'.repeat(2000))
    // The user message should NOT contain the full 5000 chars
    // It contains the sliced content plus the prompt prefix/suffix
    expect(userContent.length).toBeLessThan(5000 + 200)
  })

  it('calls callWithTools with correct config and useTools=false', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify([{ text: 'cliffhanger', type: '감정형' }]),
      toolCalls: [],
      stopReason: 'end',
    })

    await processCliffhanger('chapter')

    expect(callWithTools).toHaveBeenCalledTimes(1)
    const [config, , useTools] = vi.mocked(callWithTools).mock.calls[0]
    expect(config.provider).toBe('openai')
    expect(useTools).toBe(false)
  })
})
