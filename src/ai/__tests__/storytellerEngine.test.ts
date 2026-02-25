/**
 * Storyteller Engine unit tests — buildStorytellerPrompt integration.
 *
 * Verifies that the prompt builder correctly:
 *  - Collects segments from upstream nodes via plugins
 *  - Sorts by priority (higher first)
 *  - Appends storyteller node instructions when present
 *  - Includes context summary from previous chapters
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { CanvasNode } from '@/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetUpstreamNodes = vi.fn<[], CanvasNode[]>(() => [])
const mockNodes: CanvasNode[] = []

vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: any) => selector({ nodeOutputs: {}, wires: [], nodes: mockNodes })),
    {
      getState: vi.fn(() => ({
        getUpstreamNodes: mockGetUpstreamNodes,
        wires: [],
        nodes: mockNodes,
        getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
        updateNodeData: vi.fn(),
      })),
    },
  ),
}))

const mockWikiEntries = [
  { id: 'char-1', title: '홍길동', content: '의적 캐릭터', category: 'character' },
]

vi.mock('@/stores/wikiStore', () => ({
  useWikiStore: Object.assign(
    vi.fn((selector: any) => selector({ entries: mockWikiEntries })),
    { getState: vi.fn(() => ({ entries: mockWikiEntries })) },
  ),
}))

const mockChapters: any[] = []

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: Object.assign(
    vi.fn(() => ({})),
    { getState: vi.fn(() => ({ chapters: mockChapters, currentProject: null })) },
  ),
}))

vi.mock('@/stores/aiStore', () => ({
  useAIStore: Object.assign(
    vi.fn(() => ({})),
    { getState: vi.fn(() => ({ activeProviders: ['anthropic'], configs: { anthropic: { enabled: true } } })) },
  ),
}))

vi.mock('@/ai/providers', () => ({
  callWithTools: vi.fn().mockResolvedValue({ content: 'AI generated text' }),
}))

vi.mock('@/ai/contextSummarizer', () => ({
  summarizeContext: vi.fn((chapters: any[]) => chapters.length > 0 ? '이전 챕터 요약' : ''),
}))

// Body component mocks (not needed for engine tests, but required for builtins import)
vi.mock('@nodes/_base/CharacterNodeBody', () => ({ CharacterNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/ImageLoadBody', () => ({ ImageLoadBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/DocumentLoadBody', () => ({ DocumentLoadBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/WikiEntrySelector', () => ({ WikiEntrySelector: vi.fn(() => null) }))
vi.mock('@nodes/_base/StyleTransferNodeBody', () => ({ StyleTransferNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/VirtualReaderNodeBody', () => ({ VirtualReaderNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/SwitchNodeBody', () => ({ SwitchNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/NodeTextarea', () => ({ NodeTextarea: vi.fn(() => null) }))
vi.mock('@/lib/utils', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }))
vi.mock('@/ai/storytellerEngine', async (importOriginal) => {
  // We need the REAL implementation for buildStorytellerPrompt
  return importOriginal()
})
vi.mock('@/ai/nodeProcessors/whatIfProcessor', () => ({ processWhatIf: vi.fn().mockResolvedValue('') }))
vi.mock('@/ai/nodeProcessors/showDontTellProcessor', () => ({ processShowDontTell: vi.fn().mockResolvedValue('') }))
vi.mock('@/ai/nodeProcessors/cliffhangerProcessor', () => ({ processCliffhanger: vi.fn().mockResolvedValue('') }))
vi.mock('@/ai/nodeProcessors/virtualReaderProcessor', () => ({ processVirtualReader: vi.fn().mockResolvedValue('') }))

// ── Import real engine after mocks ────────────────────────────────────────────

import '@nodes/builtins'
import { buildStorytellerPrompt } from '@/ai/storytellerEngine'
import { useCanvasStore } from '@/stores/canvasStore'
import { useProjectStore } from '@/stores/projectStore'
import { PLOT_GENRE_OPTIONS } from '@nodes/plotOptions'
import { summarizeContext } from '@/ai/contextSummarizer'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNode(type: string, data: Record<string, any> = {}): CanvasNode {
  return {
    id: `node-${type}-1`,
    type,
    position: { x: 0, y: 0 },
    data: { nodeType: type, nodeId: `node-${type}-1`, ...data },
  } as CanvasNode
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('buildStorytellerPrompt', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Re-apply the summarizeContext mock implementation after clearAllMocks
    ;(summarizeContext as ReturnType<typeof vi.fn>).mockImplementation(
      (chapters: any[]) => (chapters.length > 0 ? '이전 챕터 요약' : ''),
    )
    mockGetUpstreamNodes.mockReturnValue([])
    mockChapters.length = 0
    mockNodes.length = 0
    // Reset project store to return no chapters (prevents leak between tests)
    ;(useProjectStore.getState as any).mockReturnValue({
      chapters: mockChapters,
      currentProject: null,
    })
  })

  it('always includes the base system instruction in Korean', () => {
    mockGetUpstreamNodes.mockReturnValue([])
    ;(useCanvasStore.getState as any).mockReturnValue({
      getUpstreamNodes: mockGetUpstreamNodes,
      nodes: [],
      wires: [],
      getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
    })

    const prompt = buildStorytellerPrompt('storyteller-node-1')
    expect(prompt).toContain('소설 집필 AI 어시스턴트')
  })

  it('includes character context when a character node is upstream', () => {
    const charNode = makeNode('character', { wikiEntryId: 'char-1' })
    mockGetUpstreamNodes.mockReturnValue([charNode])
    ;(useCanvasStore.getState as any).mockReturnValue({
      getUpstreamNodes: mockGetUpstreamNodes,
      nodes: [],
      wires: [],
      getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
    })

    const prompt = buildStorytellerPrompt('storyteller-node-1')
    expect(prompt).toContain('홍길동')
  })

  it('includes plot segment when plot_genre node is upstream', () => {
    const firstGenreId = PLOT_GENRE_OPTIONS[0]?.id
    if (!firstGenreId) return

    const plotNode = makeNode('plot_genre', { selectedGenre: firstGenreId })
    mockGetUpstreamNodes.mockReturnValue([plotNode])
    ;(useCanvasStore.getState as any).mockReturnValue({
      getUpstreamNodes: mockGetUpstreamNodes,
      nodes: [],
      wires: [],
      getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
    })

    const prompt = buildStorytellerPrompt('storyteller-node-1')
    expect(prompt).toContain('[플롯 장르:')
  })

  it('excludes upstream nodes that have no buildPromptSegment plugin method', () => {
    // image_load has buildPromptSegment but no images → returns null
    // switch node has no buildPromptSegment → getPlugin returns undefined
    const switchNode = makeNode('switch', { selectedInput: 1 })
    const imageNode = makeNode('image_load', { images: [] })
    mockGetUpstreamNodes.mockReturnValue([switchNode, imageNode])
    ;(useCanvasStore.getState as any).mockReturnValue({
      getUpstreamNodes: mockGetUpstreamNodes,
      nodes: [],
      wires: [],
      getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
    })

    const prompt = buildStorytellerPrompt('storyteller-node-1')
    // The basic system instruction should still be present
    expect(prompt).toContain('소설 집필 AI 어시스턴트')
    // No character or plot content
    expect(prompt).not.toContain('[캐릭터:')
  })

  it('sorts segments by priority (higher priority appears first in prompt)', () => {
    // character has priority 10, pov has priority 7
    const charNode = makeNode('character', { wikiEntryId: 'char-1' })
    const povNode = makeNode('pov', { povType: 'first' })
    // intentionally add pov first so we can verify sorting
    mockGetUpstreamNodes.mockReturnValue([povNode, charNode])
    ;(useCanvasStore.getState as any).mockReturnValue({
      getUpstreamNodes: mockGetUpstreamNodes,
      nodes: [],
      wires: [],
      getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
    })

    const prompt = buildStorytellerPrompt('storyteller-node-1')
    const charIdx = prompt.indexOf('[캐릭터:')
    const povIdx = prompt.indexOf('[시점 제어]')
    // character (priority 10) should appear before pov (priority 7)
    expect(charIdx).toBeGreaterThanOrEqual(0)
    expect(povIdx).toBeGreaterThanOrEqual(0)
    expect(charIdx).toBeLessThan(povIdx)
  })

  it('appends storyteller instructions section when node has instructions data', () => {
    mockGetUpstreamNodes.mockReturnValue([])
    const storytellerNode = makeNode('storyteller', { instructions: '3인칭으로 작성하세요.' })
    storytellerNode.id = 'storyteller-node-1'
    ;(useCanvasStore.getState as any).mockReturnValue({
      getUpstreamNodes: mockGetUpstreamNodes,
      nodes: [storytellerNode],
      wires: [],
      getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
    })

    const prompt = buildStorytellerPrompt('storyteller-node-1')
    expect(prompt).toContain('## 작가 지시사항')
    expect(prompt).toContain('3인칭으로 작성하세요.')
  })

  it('includes context summary when previous chapters exist', () => {
    mockGetUpstreamNodes.mockReturnValue([])
    mockChapters.push({ id: 'ch-1', type: 'chapter', title: '1장', content: '내용' })
    ;(useProjectStore.getState as any).mockReturnValue({
      chapters: [{ id: 'ch-1', type: 'chapter', title: '1장', content: '내용' }],
      currentProject: null,
    })
    ;(useCanvasStore.getState as any).mockReturnValue({
      getUpstreamNodes: mockGetUpstreamNodes,
      nodes: [],
      wires: [],
      getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
    })

    const prompt = buildStorytellerPrompt('storyteller-node-1')
    expect(prompt).toContain('## 이전 이야기 요약')
    expect(prompt).toContain('이전 챕터 요약')
  })

  it('does NOT include context summary section when no chapters exist', () => {
    mockGetUpstreamNodes.mockReturnValue([])
    ;(useCanvasStore.getState as any).mockReturnValue({
      getUpstreamNodes: mockGetUpstreamNodes,
      nodes: [],
      wires: [],
      getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
    })

    const prompt = buildStorytellerPrompt('storyteller-node-1')
    expect(prompt).not.toContain('## 이전 이야기 요약')
  })
})
