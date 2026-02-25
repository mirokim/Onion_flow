/**
 * Node plugin tests: extractData + buildPromptSegment for context, plot, and direction nodes.
 *
 * Tests focus on the pure logic in extractData / buildPromptSegment methods —
 * they don't render any React UI.
 */
import { vi, describe, it, expect, beforeAll } from 'vitest'
import type { CanvasNode, WikiEntry } from '@/types'

// ── Mocks (hoisted by Vitest) ─────────────────────────────────────────────────

vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: any) => selector({ entries: [], nodeOutputs: {}, wires: [], nodes: [] })),
    {
      getState: vi.fn(() => ({
        updateNodeData: vi.fn(),
        wires: [],
        nodes: [],
        getCurrentParentCanvasId: vi.fn(() => 'canvas-1'),
      })),
    },
  ),
}))

vi.mock('@/stores/wikiStore', () => ({
  useWikiStore: Object.assign(
    vi.fn((selector: any) => selector({ entries: [] })),
    { getState: vi.fn(() => ({ entries: [] })) },
  ),
}))

vi.mock('@/stores/aiStore', () => ({
  useAIStore: Object.assign(
    vi.fn(() => ({})),
    { getState: vi.fn(() => ({ activeProviders: [], configs: {} })) },
  ),
}))

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: Object.assign(
    vi.fn(() => ({})),
    { getState: vi.fn(() => ({ currentProject: null })) },
  ),
}))

vi.mock('@/ai/storytellerEngine', () => ({
  runStoryteller: vi.fn().mockResolvedValue(''),
}))

vi.mock('@/ai/providers', () => ({
  callWithTools: vi.fn().mockResolvedValue({ content: '' }),
}))

vi.mock('@/ai/nodeProcessors/whatIfProcessor', () => ({
  processWhatIf: vi.fn().mockResolvedValue(''),
}))

vi.mock('@/ai/nodeProcessors/showDontTellProcessor', () => ({
  processShowDontTell: vi.fn().mockResolvedValue(''),
}))

vi.mock('@/ai/nodeProcessors/cliffhangerProcessor', () => ({
  processCliffhanger: vi.fn().mockResolvedValue(''),
}))

vi.mock('@/ai/nodeProcessors/virtualReaderProcessor', () => ({
  processVirtualReader: vi.fn().mockResolvedValue(''),
}))

vi.mock('@/lib/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}))

// React component mocks (body components — not tested here)
vi.mock('@nodes/_base/CharacterNodeBody', () => ({ CharacterNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/ImageLoadBody', () => ({ ImageLoadBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/DocumentLoadBody', () => ({ DocumentLoadBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/WikiEntrySelector', () => ({ WikiEntrySelector: vi.fn(() => null) }))
vi.mock('@nodes/_base/StyleTransferNodeBody', () => ({ StyleTransferNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/VirtualReaderNodeBody', () => ({ VirtualReaderNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/SwitchNodeBody', () => ({ SwitchNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/NodeTextarea', () => ({ NodeTextarea: vi.fn(() => null) }))

// ── Register all plugins (side-effects) ──────────────────────────────────────

// Import after all mocks are set up
import '@nodes/builtins'
import { getPlugin } from '@nodes/plugin'
import { PLOT_STRUCTURE_OPTIONS, PLOT_GENRE_OPTIONS } from '@nodes/plotOptions'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNode(type: string, data: Record<string, any> = {}): CanvasNode {
  return {
    id: `node-${type}-test`,
    type,
    position: { x: 0, y: 0 },
    data: { nodeType: type, nodeId: `node-${type}-test`, ...data },
  } as CanvasNode
}

function makeWikiEntry(overrides: Partial<WikiEntry> = {}): WikiEntry {
  return {
    id: 'wiki-1',
    projectId: 'proj-1',
    title: '테스트 항목',
    content: '테스트 내용입니다.',
    category: 'character',
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as WikiEntry
}

// ── contextNodes tests ─────────────────────────────────────────────────────────

describe('contextNodes — character plugin', () => {
  const wikiEntry = makeWikiEntry({ id: 'char-1', title: '홍길동', content: '의적입니다.' })
  const wikiEntries = [wikiEntry]

  it('extractData with wikiEntryId returns formatted character text', () => {
    const node = makeNode('character', { wikiEntryId: 'char-1' })
    const result = getPlugin('character')?.extractData?.(node, wikiEntries)
    expect(result).toContain('[캐릭터: 홍길동]')
    expect(result).toContain('의적입니다.')
  })

  it('extractData without wikiEntryId returns null', () => {
    const node = makeNode('character', { wikiEntryId: null })
    const result = getPlugin('character')?.extractData?.(node, [])
    expect(result).toBeNull()
  })

  it('buildPromptSegment with wikiEntryId returns segment with correct priority', () => {
    const node = makeNode('character', { wikiEntryId: 'char-1' })
    const seg = getPlugin('character')?.buildPromptSegment?.(node, wikiEntries)
    expect(seg).not.toBeNull()
    expect(seg?.priority).toBe(10)
    expect(seg?.role).toBe('character_context')
    expect(seg?.content).toContain('홍길동')
  })

  it('buildPromptSegment without wikiEntryId returns null', () => {
    const node = makeNode('character', {})
    const seg = getPlugin('character')?.buildPromptSegment?.(node, [])
    expect(seg).toBeNull()
  })
})

describe('contextNodes — event plugin', () => {
  const wikiEntry = makeWikiEntry({ id: 'event-1', title: '대전투', content: '큰 전투가 있었다.', category: 'event' })
  const wikiEntries = [wikiEntry]

  it('extractData with wiki entry returns [사건] prefix', () => {
    const node = makeNode('event', { wikiEntryId: 'event-1' })
    const result = getPlugin('event')?.extractData?.(node, wikiEntries)
    expect(result).toContain('[사건]')
    expect(result).toContain('큰 전투가 있었다.')
  })

  it('buildPromptSegment returns event_context role', () => {
    const node = makeNode('event', { wikiEntryId: 'event-1' })
    const seg = getPlugin('event')?.buildPromptSegment?.(node, wikiEntries)
    expect(seg?.role).toBe('event_context')
    expect(seg?.content).toContain('[사건/환경]')
    expect(seg?.priority).toBe(9)
  })

  it('extractData without wikiEntryId returns null', () => {
    const node = makeNode('event', {})
    const result = getPlugin('event')?.extractData?.(node, [])
    expect(result).toBeNull()
  })
})

describe('contextNodes — memory plugin', () => {
  const wikiEntry = makeWikiEntry({ id: 'mem-1', title: '어린 시절', content: '고아였다.', category: 'character_memory' })

  it('buildPromptSegment returns [기억/배경] prefix', () => {
    const node = makeNode('memory', { wikiEntryId: 'mem-1' })
    const seg = getPlugin('memory')?.buildPromptSegment?.(node, [wikiEntry])
    expect(seg?.content).toContain('[기억/배경]')
    expect(seg?.priority).toBe(10)
  })
})

// ── plotNodes tests ────────────────────────────────────────────────────────────

describe('plotNodes — plot_genre plugin', () => {
  it('extractData with selected genre returns label and description', () => {
    const node = makeNode('plot_genre', { selectedGenre: 'fantasy' })
    const result = getPlugin('plot_genre')?.extractData?.(node, [])
    // result should contain "[플롯 장르: ...]" with some label and description
    expect(result).toMatch(/\[플롯 장르:/)
  })

  it('extractData without selection returns null', () => {
    const node = makeNode('plot_genre', { selectedGenre: null })
    const result = getPlugin('plot_genre')?.extractData?.(node, [])
    expect(result).toBeNull()
  })

  it('buildPromptSegment with selection returns priority 9', () => {
    // Use a known-valid genre id from the options
    const firstGenreId = PLOT_GENRE_OPTIONS[0]?.id
    if (!firstGenreId) return
    const node = makeNode('plot_genre', { selectedGenre: firstGenreId })
    const seg = getPlugin('plot_genre')?.buildPromptSegment?.(node, [])
    expect(seg).not.toBeNull()
    expect(seg?.priority).toBe(9)
    expect(seg?.role).toBe('plot_context')
  })

  it('buildPromptSegment without selection returns null', () => {
    const node = makeNode('plot_genre', { selectedGenre: null })
    const seg = getPlugin('plot_genre')?.buildPromptSegment?.(node, [])
    expect(seg).toBeNull()
  })
})

describe('plotNodes — plot_structure plugin', () => {
  it('extractData with selected structure returns formatted text', () => {
    const firstId = PLOT_STRUCTURE_OPTIONS[0]?.id
    if (!firstId) return // skip if no options defined
    const node = makeNode('plot_structure', { selectedStructure: firstId })
    const result = getPlugin('plot_structure')?.extractData?.(node, [])
    expect(result).toMatch(/\[플롯 형식:/)
  })

  it('extractData without selection returns null', () => {
    const node = makeNode('plot_structure', { selectedStructure: null })
    const result = getPlugin('plot_structure')?.extractData?.(node, [])
    expect(result).toBeNull()
  })
})

describe('plotNodes — plot_context plugin', () => {
  const plotEntry = makeWikiEntry({ id: 'plot-1', title: '1부', content: '이야기 시작', category: 'plot' })

  it('extractData with wikiEntryId returns [플롯: ...] text', () => {
    const node = makeNode('plot_context', { wikiEntryId: 'plot-1' })
    const result = getPlugin('plot_context')?.extractData?.(node, [plotEntry])
    expect(result).toContain('[플롯: 1부]')
    expect(result).toContain('이야기 시작')
  })

  it('buildPromptSegment with wikiEntryId returns priority 9', () => {
    const node = makeNode('plot_context', { wikiEntryId: 'plot-1' })
    const seg = getPlugin('plot_context')?.buildPromptSegment?.(node, [plotEntry])
    expect(seg?.priority).toBe(9)
    expect(seg?.content).toContain('[플롯: 1부]')
  })

  it('extractData without wikiEntryId returns null', () => {
    const node = makeNode('plot_context', { wikiEntryId: null })
    const result = getPlugin('plot_context')?.extractData?.(node, [])
    expect(result).toBeNull()
  })
})

// ── directionNodes tests ───────────────────────────────────────────────────────

describe('directionNodes — pov plugin', () => {
  it('buildPromptSegment returns DIRECTION role with priority 7', () => {
    const node = makeNode('pov', { povType: 'first' })
    const seg = getPlugin('pov')?.buildPromptSegment?.(node, [])
    expect(seg?.role).toBe('direction')
    expect(seg?.priority).toBe(7)
    expect(seg?.content).toContain('[시점 제어]')
    expect(seg?.content).toContain('1인칭')
  })

  it('buildPromptSegment includes focus character name when characterId set', () => {
    const charEntry = makeWikiEntry({ id: 'char-2', title: '이순신', category: 'character' })
    const node = makeNode('pov', { povType: 'third_limited', characterId: 'char-2' })
    const seg = getPlugin('pov')?.buildPromptSegment?.(node, [charEntry])
    expect(seg?.content).toContain('이순신')
  })

  it('extractData returns pov type string', () => {
    const node = makeNode('pov', { povType: 'second' })
    const result = getPlugin('pov')?.extractData?.(node, [])
    expect(result).toContain('[시점]')
    expect(result).toContain('2인칭')
  })
})

describe('directionNodes — pacing plugin', () => {
  it('buildPromptSegment returns tension and speed text', () => {
    const node = makeNode('pacing', { tension: 8, speed: 'fast' })
    const seg = getPlugin('pacing')?.buildPromptSegment?.(node, [])
    expect(seg?.content).toContain('[텐션/호흡]')
    expect(seg?.content).toContain('8/10')
    expect(seg?.content).toContain('빠름')
  })

  it('extractData returns formatted tension/speed text', () => {
    const node = makeNode('pacing', { tension: 3, speed: 'slow' })
    const result = getPlugin('pacing')?.extractData?.(node, [])
    expect(result).toContain('[텐션]')
    expect(result).toContain('3/10')
    expect(result).toContain('느림')
  })
})

describe('directionNodes — style_transfer plugin', () => {
  it('buildPromptSegment with no sampleText and no authorName returns null', () => {
    const node = makeNode('style_transfer', { sampleText: '', authorName: '' })
    const seg = getPlugin('style_transfer')?.buildPromptSegment?.(node, [])
    expect(seg).toBeNull()
  })

  it('buildPromptSegment with authorName returns segment', () => {
    const node = makeNode('style_transfer', { sampleText: '', authorName: '한강' })
    const seg = getPlugin('style_transfer')?.buildPromptSegment?.(node, [])
    expect(seg).not.toBeNull()
    expect(seg?.content).toContain('한강')
  })

  it('buildPromptSegment with sampleText returns segment with priority 6', () => {
    const node = makeNode('style_transfer', { sampleText: '문체 샘플 텍스트입니다.', authorName: '' })
    const seg = getPlugin('style_transfer')?.buildPromptSegment?.(node, [])
    expect(seg?.priority).toBe(6)
  })

  it('extractData with authorName and sampleText returns [문체] text', () => {
    const node = makeNode('style_transfer', { sampleText: '샘플', authorName: '무라카미' })
    const result = getPlugin('style_transfer')?.extractData?.(node, [])
    expect(result).toContain('[문체]')
    expect(result).toContain('무라카미')
  })
})

// ── processingNodes tests ──────────────────────────────────────────────────────

describe('processingNodes — storyteller plugin', () => {
  it('storyteller has no buildPromptSegment (it is an executable node, not context)', () => {
    const seg = getPlugin('storyteller')?.buildPromptSegment
    expect(seg).toBeUndefined()
  })

  it('storyteller is registered as executable', () => {
    expect(getPlugin('storyteller')?.isExecutable).toBe(true)
  })
})

describe('processingNodes — switch plugin', () => {
  it('getAllowedInputHandles returns only the selected input handle', () => {
    const node = makeNode('switch', { selectedInput: 3 })
    const allowed = getPlugin('switch')?.getAllowedInputHandles?.(node)
    expect(allowed).toEqual(new Set(['in_3']))
  })

  it('getAllowedInputHandles defaults to in_1 when selectedInput is not set', () => {
    const node = makeNode('switch', {})
    const allowed = getPlugin('switch')?.getAllowedInputHandles?.(node)
    expect(allowed).toEqual(new Set(['in_1']))
  })
})

// ── Plugin registry completeness ──────────────────────────────────────────────

describe('Plugin registry', () => {
  const expectedTypes = [
    'character', 'memory', 'motivation', 'event', 'wiki', 'image_load', 'document_load',
    'plot_genre', 'plot_structure', 'plot_context',
    'pov', 'pacing', 'style_transfer', 'output_format',
    'storyteller', 'summarizer', 'switch', 'smart_switch',
    'what_if', 'show_dont_tell', 'tikitaka', 'cliffhanger',
    'emotion_tracker', 'foreshadow_detector', 'conflict_defense',
    'virtual_reader', 'preview_changed',
    'save_content', 'preview_content',
    'group',
  ]

  it.each(expectedTypes)('plugin "%s" is registered', (type) => {
    expect(getPlugin(type)).toBeDefined()
  })

  it('unknown type returns undefined', () => {
    expect(getPlugin('not_a_real_node')).toBeUndefined()
  })
})
