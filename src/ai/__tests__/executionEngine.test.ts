/**
 * Execution Engine unit tests.
 *
 * Tests cover:
 *  - smart_switch getAllowedInputHandles (sequential mode, random mode, wrap-around)
 *  - extractData delegation via plugin registry
 *  - executeCanvas node filtering and callback flow
 *  - getExecutableTypes registry completeness
 */
import { vi, describe, it, expect, beforeEach } from 'vitest'
import type { CanvasNode, CanvasWire } from '@/types'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockWires: CanvasWire[] = []
const mockNodes: CanvasNode[] = []
const mockNodeOutputs: Record<string, any> = {}
const mockUpdateNodeData = vi.fn()
const mockParentCanvasId = 'canvas-1'

vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: Object.assign(
    vi.fn((selector: any) => selector({
      wires: mockWires,
      nodes: mockNodes,
      nodeOutputs: mockNodeOutputs,
    })),
    {
      getState: vi.fn(() => ({
        wires: mockWires,
        nodes: mockNodes,
        nodeOutputs: mockNodeOutputs,
        updateNodeData: mockUpdateNodeData,
        getCurrentParentCanvasId: vi.fn(() => mockParentCanvasId),
        getUpstreamNodes: vi.fn(() => []),
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
    { getState: vi.fn(() => ({ activeProviders: ['anthropic'], configs: { anthropic: { enabled: true } } })) },
  ),
}))

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: Object.assign(
    vi.fn(() => ({})),
    { getState: vi.fn(() => ({ currentProject: null, chapters: [] })) },
  ),
}))

vi.mock('@/ai/providers', () => ({
  callWithTools: vi.fn().mockResolvedValue({ content: 'mocked AI result' }),
}))

vi.mock('@/ai/storytellerEngine', () => ({
  runStoryteller: vi.fn().mockResolvedValue('storyteller result'),
}))

vi.mock('@/ai/contextSummarizer', () => ({
  summarizeContext: vi.fn(() => ''),
}))

vi.mock('@/ai/nodeProcessors/whatIfProcessor', () => ({ processWhatIf: vi.fn().mockResolvedValue('') }))
vi.mock('@/ai/nodeProcessors/showDontTellProcessor', () => ({ processShowDontTell: vi.fn().mockResolvedValue('') }))
vi.mock('@/ai/nodeProcessors/cliffhangerProcessor', () => ({ processCliffhanger: vi.fn().mockResolvedValue('') }))
vi.mock('@/ai/nodeProcessors/virtualReaderProcessor', () => ({ processVirtualReader: vi.fn().mockResolvedValue('') }))

// React component mocks
vi.mock('@nodes/_base/CharacterNodeBody', () => ({ CharacterNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/ImageLoadBody', () => ({ ImageLoadBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/DocumentLoadBody', () => ({ DocumentLoadBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/WikiEntrySelector', () => ({ WikiEntrySelector: vi.fn(() => null) }))
vi.mock('@nodes/_base/StyleTransferNodeBody', () => ({ StyleTransferNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/VirtualReaderNodeBody', () => ({ VirtualReaderNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/SwitchNodeBody', () => ({ SwitchNodeBody: vi.fn(() => null) }))
vi.mock('@nodes/_base/NodeTextarea', () => ({ NodeTextarea: vi.fn(() => null) }))
vi.mock('@/lib/utils', () => ({ cn: (...args: any[]) => args.filter(Boolean).join(' ') }))

// ── Imports after mocks ───────────────────────────────────────────────────────

import '@nodes/builtins'
import { getPlugin, getAllPlugins } from '@nodes/plugin'
import { getExecutableTypes } from '@nodes/index'
import { executeCanvas } from '@/ai/executionEngine'
import { useCanvasStore } from '@/stores/canvasStore'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeNode(type: string, data: Record<string, any> = {}, id?: string): CanvasNode {
  const nodeId = id ?? `node-${type}-1`
  return {
    id: nodeId,
    type,
    parentCanvasId: mockParentCanvasId,
    position: { x: 0, y: 0 },
    data: { nodeType: type, nodeId, ...data },
  } as unknown as CanvasNode
}

function makeWire(
  sourceNodeId: string,
  targetNodeId: string,
  targetHandle?: string,
  sourceHandle?: string,
): CanvasWire {
  return {
    id: `wire-${sourceNodeId}-${targetNodeId}-${targetHandle ?? ''}`,
    sourceNodeId,
    targetNodeId,
    sourceHandle: sourceHandle ?? 'out',
    targetHandle: targetHandle ?? 'in',
    parentCanvasId: mockParentCanvasId,
  } as CanvasWire
}

// ── smart_switch — getAllowedInputHandles ─────────────────────────────────────

describe('smart_switch — getAllowedInputHandles', () => {
  beforeEach(() => {
    mockWires.length = 0
    mockNodes.length = 0
    mockUpdateNodeData.mockClear()
    ;(useCanvasStore.getState as any).mockReturnValue({
      wires: mockWires,
      nodes: mockNodes,
      nodeOutputs: mockNodeOutputs,
      updateNodeData: mockUpdateNodeData,
      getCurrentParentCanvasId: vi.fn(() => mockParentCanvasId),
      getUpstreamNodes: vi.fn(() => []),
    })
  })

  it('sequential mode: returns in_1 on first run (currentIndex=0, one wire connected)', () => {
    const node = makeNode('smart_switch', { mode: 'sequential', currentIndex: 0 })
    mockWires.push(makeWire('node-char-1', node.id, 'in_1'))

    const allowed = getPlugin('smart_switch')?.getAllowedInputHandles?.(node)
    expect(allowed).toEqual(new Set(['in_1']))
  })

  it('sequential mode: returns in_2 when currentIndex=1', () => {
    const node = makeNode('smart_switch', { mode: 'sequential', currentIndex: 1 })
    mockWires.push(makeWire('node-a', node.id, 'in_1'))
    mockWires.push(makeWire('node-b', node.id, 'in_2'))

    const allowed = getPlugin('smart_switch')?.getAllowedInputHandles?.(node)
    expect(allowed).toEqual(new Set(['in_2']))
  })

  it('sequential mode: wraps around after last connected input', () => {
    // 2 inputs connected (in_1, in_2), currentIndex=2 → wraps to index 0 → in_1
    const node = makeNode('smart_switch', { mode: 'sequential', currentIndex: 2 })
    mockWires.push(makeWire('node-a', node.id, 'in_1'))
    mockWires.push(makeWire('node-b', node.id, 'in_2'))

    const allowed = getPlugin('smart_switch')?.getAllowedInputHandles?.(node)
    // 2 % 2 = 0, so connectedHandles[0] = 'in_1'
    expect(allowed).toEqual(new Set(['in_1']))
  })

  it('returns null when no handles are connected', () => {
    const node = makeNode('smart_switch', { mode: 'sequential', currentIndex: 0 })
    // no wires to this node
    const allowed = getPlugin('smart_switch')?.getAllowedInputHandles?.(node)
    expect(allowed).toBeNull()
  })

  it('random mode: returns one of the connected handles', () => {
    const node = makeNode('smart_switch', { mode: 'random', currentIndex: 0 })
    mockWires.push(makeWire('node-a', node.id, 'in_1'))
    mockWires.push(makeWire('node-b', node.id, 'in_2'))
    mockWires.push(makeWire('node-c', node.id, 'in_3'))

    const allowed = getPlugin('smart_switch')?.getAllowedInputHandles?.(node)
    expect(allowed).not.toBeNull()
    // Should be one of the connected handles
    const handle = [...(allowed as Set<string>)][0]
    expect(['in_1', 'in_2', 'in_3']).toContain(handle)
  })
})

// ── switch — getAllowedInputHandles ───────────────────────────────────────────

describe('switch — getAllowedInputHandles', () => {
  it('returns only the selected input handle', () => {
    const node = makeNode('switch', { selectedInput: 2 })
    const allowed = getPlugin('switch')?.getAllowedInputHandles?.(node)
    expect(allowed).toEqual(new Set(['in_2']))
  })

  it('defaults to in_1 when selectedInput is undefined', () => {
    const node = makeNode('switch', {})
    const allowed = getPlugin('switch')?.getAllowedInputHandles?.(node)
    expect(allowed).toEqual(new Set(['in_1']))
  })
})

// ── extractData delegation ────────────────────────────────────────────────────

describe('extractNodeDataText (via plugin.extractData)', () => {
  it('returns null for nodes without an extractData method', () => {
    // switch and smart_switch have no extractData
    const switchNode = makeNode('switch', { selectedInput: 1 })
    const result = getPlugin('switch')?.extractData?.(switchNode, [])
    expect(result).toBeUndefined()
  })

  it('returns null for storyteller (executable-only, no extractData)', () => {
    const node = makeNode('storyteller', {})
    const result = getPlugin('storyteller')?.extractData?.(node, [])
    expect(result).toBeUndefined()
  })

  it('delegates to plugin.extractData for pov node', () => {
    const node = makeNode('pov', { povType: 'first' })
    const result = getPlugin('pov')?.extractData?.(node, [])
    expect(result).toContain('[시점]')
    expect(result).toContain('1인칭')
  })

  it('delegates to plugin.extractData for pacing node', () => {
    const node = makeNode('pacing', { tension: 7, speed: 'fast' })
    const result = getPlugin('pacing')?.extractData?.(node, [])
    expect(result).toContain('[텐션]')
    expect(result).toContain('7/10')
  })
})

// ── getExecutableTypes ────────────────────────────────────────────────────────

describe('getExecutableTypes', () => {
  it('includes storyteller as executable', () => {
    const types = getExecutableTypes()
    expect(types.has('storyteller')).toBe(true)
  })

  it('includes summarizer as executable', () => {
    expect(getExecutableTypes().has('summarizer')).toBe(true)
  })

  it('includes smart_switch as executable', () => {
    expect(getExecutableTypes().has('smart_switch')).toBe(true)
  })

  it('does NOT include character as executable', () => {
    expect(getExecutableTypes().has('character')).toBe(false)
  })

  it('does NOT include pov as executable', () => {
    expect(getExecutableTypes().has('pov')).toBe(false)
  })

  it('does NOT include plot_genre as executable', () => {
    expect(getExecutableTypes().has('plot_genre')).toBe(false)
  })
})

// ── executeCanvas integration ─────────────────────────────────────────────────

describe('executeCanvas — node filtering and callback flow', () => {
  beforeEach(() => {
    mockWires.length = 0
    mockNodes.length = 0
    Object.keys(mockNodeOutputs).forEach(k => delete mockNodeOutputs[k])
    ;(useCanvasStore.getState as any).mockReturnValue({
      wires: mockWires,
      nodes: mockNodes,
      nodeOutputs: mockNodeOutputs,
      updateNodeData: mockUpdateNodeData,
      getCurrentParentCanvasId: vi.fn(() => mockParentCanvasId),
      getUpstreamNodes: vi.fn(() => []),
    })
  })

  it('callback is called with queued → running → completed for storyteller node', async () => {
    const storytellerNode = makeNode('storyteller', {}, 'st-1')
    mockNodes.push(storytellerNode)

    const callback = vi.fn()
    await executeCanvas(callback)

    const calls = callback.mock.calls.map(([id, out]) => ({ id, status: out.status }))
    expect(calls).toContainEqual({ id: 'st-1', status: 'queued' })
    expect(calls).toContainEqual({ id: 'st-1', status: 'running' })
    expect(calls).toContainEqual({ id: 'st-1', status: 'completed' })
  })

  it('non-executable nodes (character, pov) are NOT passed to the callback', async () => {
    const charNode = makeNode('character', {}, 'char-1')
    const povNode = makeNode('pov', {}, 'pov-1')
    mockNodes.push(charNode, povNode)

    const callback = vi.fn()
    await executeCanvas(callback)

    const calledIds = callback.mock.calls.map(([id]) => id)
    expect(calledIds).not.toContain('char-1')
    expect(calledIds).not.toContain('pov-1')
  })

  it('callback receives error status when plugin execute throws', async () => {
    const { runStoryteller } = await import('@/ai/storytellerEngine')
    ;(runStoryteller as any).mockRejectedValueOnce(new Error('AI 오류'))

    const storytellerNode = makeNode('storyteller', {}, 'st-error-1')
    mockNodes.push(storytellerNode)

    const callback = vi.fn()
    await executeCanvas(callback)

    const errorCall = callback.mock.calls.find(([id, out]) => id === 'st-error-1' && out.status === 'error')
    expect(errorCall).toBeDefined()
    expect(errorCall![1].error).toContain('AI 오류')
  })

  it('executes nodes in topological order (upstream storyteller before downstream summarizer)', async () => {
    const stNode = makeNode('storyteller', {}, 'st-topo')
    const sumNode = makeNode('summarizer', {}, 'sum-topo')
    mockNodes.push(stNode, sumNode)
    // storyteller → summarizer
    mockWires.push(makeWire('st-topo', 'sum-topo', 'in', 'out'))

    const executionOrder: string[] = []
    const callback = vi.fn((id, output) => {
      if (output.status === 'running') executionOrder.push(id)
    })

    await executeCanvas(callback)

    const stIdx = executionOrder.indexOf('st-topo')
    const sumIdx = executionOrder.indexOf('sum-topo')
    expect(stIdx).toBeGreaterThanOrEqual(0)
    expect(sumIdx).toBeGreaterThanOrEqual(0)
    expect(stIdx).toBeLessThan(sumIdx)
  })
})
