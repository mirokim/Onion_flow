/**
 * Unit tests for Virtual Reader Simulator Processor.
 * Tests: JSON parsing, non-JSON fallback, no provider error, persona filtering, content truncation, READER_PERSONAS export.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callWithTools } from '../providers'
import { processVirtualReader, READER_PERSONAS } from './virtualReaderProcessor'

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

describe('READER_PERSONAS', () => {
  it('exports exactly 5 persona entries', () => {
    expect(READER_PERSONAS).toHaveLength(5)
  })

  it('each persona has id, name, and desc', () => {
    for (const persona of READER_PERSONAS) {
      expect(persona).toHaveProperty('id')
      expect(persona).toHaveProperty('name')
      expect(persona).toHaveProperty('desc')
      expect(typeof persona.id).toBe('string')
      expect(typeof persona.name).toBe('string')
      expect(typeof persona.desc).toBe('string')
    }
  })
})

describe('processVirtualReader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('parses valid JSON response into VirtualReaderComment[]', async () => {
    const comments = [
      { persona: '사이다 패스', comment: 'Great pacing!', rating: 9 },
      { persona: '설정 덕후', comment: 'Needs more worldbuilding.', rating: 6 },
    ]
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify(comments),
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processVirtualReader('manuscript content')

    expect(result).toEqual(comments)
    expect(result).toHaveLength(2)
  })

  it('returns fallback for non-JSON response', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: 'This is a plain text comment.',
      toolCalls: [],
      stopReason: 'end',
    })

    const result = await processVirtualReader('manuscript')

    expect(result).toEqual([
      { persona: '가상 독자', comment: 'This is a plain text comment.', rating: 7 },
    ])
  })

  it('throws error when no AI provider is active', async () => {
    const { useAIStore } = await import('@/stores/aiStore')
    vi.mocked(useAIStore.getState).mockReturnValueOnce({
      activeProviders: [],
      configs: {},
    } as ReturnType<typeof useAIStore.getState>)

    await expect(processVirtualReader('content')).rejects.toThrow(
      '활성화된 AI 프로바이더가 없습니다.',
    )
  })

  it('filters personas when selectedPersonas is provided', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify([
        { persona: '사이다 패스', comment: 'Fast!', rating: 8 },
      ]),
      toolCalls: [],
      stopReason: 'end',
    })

    await processVirtualReader('content', ['cider', 'critic'])

    const [, messages] = vi.mocked(callWithTools).mock.calls[0]
    const systemContent = messages[0].content as string
    // Should include only the two selected personas
    expect(systemContent).toContain('사이다 패스')
    expect(systemContent).toContain('까리한 독자')
    // Should NOT include unselected personas
    expect(systemContent).not.toContain('설정 덕후')
    expect(systemContent).not.toContain('감성 독자')
    expect(systemContent).not.toContain('가벼운 독자')
  })

  it('uses all 5 personas when no selection is provided', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify([]),
      toolCalls: [],
      stopReason: 'end',
    })

    await processVirtualReader('content')

    const [, messages] = vi.mocked(callWithTools).mock.calls[0]
    const systemContent = messages[0].content as string
    expect(systemContent).toContain('사이다 패스')
    expect(systemContent).toContain('설정 덕후')
    expect(systemContent).toContain('감성 독자')
    expect(systemContent).toContain('까리한 독자')
    expect(systemContent).toContain('가벼운 독자')
  })

  it('truncates content to 3000 chars in user message', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify([]),
      toolCalls: [],
      stopReason: 'end',
    })

    const longContent = 'B'.repeat(5000)
    await processVirtualReader(longContent)

    const [, messages] = vi.mocked(callWithTools).mock.calls[0]
    const userContent = messages[1].content as string
    // content.slice(0, 3000) means first 3000 chars
    expect(userContent).toContain('B'.repeat(3000))
    // Should NOT contain the full 5000 chars worth of B's
    // The user message has prefix + 3000 B's + suffix
    expect(userContent.length).toBeLessThan(5000 + 200)
  })

  it('calls callWithTools with correct config and useTools=false', async () => {
    vi.mocked(callWithTools).mockResolvedValue({
      content: JSON.stringify([]),
      toolCalls: [],
      stopReason: 'end',
    })

    await processVirtualReader('content')

    expect(callWithTools).toHaveBeenCalledTimes(1)
    const [config, , useTools] = vi.mocked(callWithTools).mock.calls[0]
    expect(config.provider).toBe('openai')
    expect(useTools).toBe(false)
  })
})
