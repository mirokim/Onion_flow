/**
 * Unit tests for executionEngine module.
 * Tests: executeCanvas with mocked stores and processors —
 *        node filtering, execution order, status callbacks, error handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { CanvasNode, CanvasWire } from '@/types'
import type { NodeOutput } from '@/stores/canvasStore'

// ── Mocks ──

const mockGetState = vi.fn()

vi.mock('@/stores/canvasStore', () => ({
  useCanvasStore: {
    getState: (...args: any[]) => mockGetState(...args),
  },
}))

vi.mock('@/stores/aiStore', () => ({
  useAIStore: {
    getState: vi.fn(() => ({
      activeProviders: ['openai'],
      configs: { openai: { model: 'gpt-4' } },
    })),
  },
}))

vi.mock('./storytellerEngine', () => ({
  runStoryteller: vi.fn(),
  buildStorytellerPrompt: vi.fn(),
}))
vi.mock('./nodeProcessors/whatIfProcessor', () => ({ processWhatIf: vi.fn() }))
vi.mock('./nodeProcessors/showDontTellProcessor', () => ({ processShowDontTell: vi.fn() }))
vi.mock('./nodeProcessors/tikitakaProcessor', () => ({ processTikitaka: vi.fn() }))
vi.mock('./nodeProcessors/cliffhangerProcessor', () => ({ processCliffhanger: vi.fn() }))
vi.mock('./nodeProcessors/virtualReaderProcessor', () => ({ processVirtualReader: vi.fn() }))

import { executeCanvas } from './executionEngine'
import { runStoryteller } from './storytellerEngine'

// ── Helpers ──

function makeNode(overrides: Partial<CanvasNode> & { id: string; type: string }): CanvasNode {
  return {
    id: overrides.id,
    projectId: overrides.projectId ?? 'proj-1',
    parentCanvasId: overrides.parentCanvasId ?? null,
    type: overrides.type as any,
    position: overrides.position ?? { x: 0, y: 0 },
    data: overrides.data ?? {},
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
  }
}

function makeWire(overrides: Partial<CanvasWire> & { sourceNodeId: string; targetNodeId: string }): CanvasWire {
  return {
    id: overrides.id ?? `wire-${overrides.sourceNodeId}-${overrides.targetNodeId}`,
    projectId: overrides.projectId ?? 'proj-1',
    parentCanvasId: overrides.parentCanvasId ?? null,
    sourceNodeId: overrides.sourceNodeId,
    targetNodeId: overrides.targetNodeId,
    sourceHandle: overrides.sourceHandle ?? 'output',
    targetHandle: overrides.targetHandle ?? 'input',
  }
}

function setupCanvasState(nodes: CanvasNode[], wires: CanvasWire[], depthPath: string[] = []) {
  mockGetState.mockReturnValue({
    nodes,
    wires,
    nodeOutputs: {},
    currentDepthPath: depthPath,
    getCurrentParentCanvasId: () => depthPath.length > 0 ? depthPath[depthPath.length - 1] : null,
  })
}

// ── Tests ──

beforeEach(() => {
  vi.clearAllMocks()
})

describe('executeCanvas', () => {
  it('does not call callback with running/completed when there are no executable nodes', async () => {
    const nodes = [
      makeNode({ id: 'n1', type: 'character' }),
      makeNode({ id: 'n2', type: 'event' }),
      makeNode({ id: 'n3', type: 'pov' }),
    ]
    setupCanvasState(nodes, [])

    const callback = vi.fn()
    await executeCanvas(callback)

    // No executable nodes means no queued/running/completed callbacks
    expect(callback).not.toHaveBeenCalled()
  })

  it('executes a single storyteller node and reports queued -> running -> completed', async () => {
    const nodes = [makeNode({ id: 'st-1', type: 'storyteller' })]
    setupCanvasState(nodes, [])

    vi.mocked(runStoryteller).mockResolvedValue('Generated story text')

    const callback = vi.fn()
    await executeCanvas(callback)

    // First call: queued
    expect(callback).toHaveBeenNthCalledWith(1, 'st-1', { status: 'queued', content: '' })
    // Second call: running
    expect(callback).toHaveBeenNthCalledWith(2, 'st-1', { status: 'running', content: '' })
    // Third call: completed with content
    expect(callback).toHaveBeenNthCalledWith(3, 'st-1', { status: 'completed', content: 'Generated story text' })
    expect(callback).toHaveBeenCalledTimes(3)
  })

  it('skips non-executable node types (character, event, pov)', async () => {
    const nodes = [
      makeNode({ id: 'char-1', type: 'character' }),
      makeNode({ id: 'evt-1', type: 'event' }),
      makeNode({ id: 'pov-1', type: 'pov' }),
      makeNode({ id: 'st-1', type: 'storyteller' }),
    ]
    setupCanvasState(nodes, [])

    vi.mocked(runStoryteller).mockResolvedValue('story')

    const callback = vi.fn()
    await executeCanvas(callback)

    // Only the storyteller node should produce callbacks
    const calledNodeIds = callback.mock.calls.map((call: unknown[]) => call[0])
    expect(calledNodeIds).not.toContain('char-1')
    expect(calledNodeIds).not.toContain('evt-1')
    expect(calledNodeIds).not.toContain('pov-1')
    expect(calledNodeIds).toContain('st-1')
  })

  it('reports error status when node execution throws', async () => {
    const nodes = [makeNode({ id: 'st-err', type: 'storyteller' })]
    setupCanvasState(nodes, [])

    vi.mocked(runStoryteller).mockRejectedValue(new Error('AI provider unavailable'))

    const callback = vi.fn()
    await executeCanvas(callback)

    // queued -> running -> error
    expect(callback).toHaveBeenNthCalledWith(1, 'st-err', { status: 'queued', content: '' })
    expect(callback).toHaveBeenNthCalledWith(2, 'st-err', { status: 'running', content: '' })
    expect(callback).toHaveBeenNthCalledWith(3, 'st-err', {
      status: 'error',
      content: '',
      error: 'AI provider unavailable',
    })
  })

  it('executes nodes in topological order (source before target)', async () => {
    // Graph: A (storyteller) -> B (what_if)
    // A should execute before B
    const nodeA = makeNode({ id: 'A', type: 'storyteller' })
    const nodeB = makeNode({ id: 'B', type: 'what_if' })
    const wire = makeWire({ sourceNodeId: 'A', targetNodeId: 'B' })
    setupCanvasState([nodeB, nodeA], [wire]) // deliberately reversed order in array

    vi.mocked(runStoryteller).mockResolvedValue('story from A')

    const { processWhatIf } = await import('./nodeProcessors/whatIfProcessor')
    vi.mocked(processWhatIf).mockResolvedValue({ branchA: 'Branch A text', branchB: 'Branch B text' })

    const executionOrder: string[] = []
    const callback = vi.fn((nodeId: string, output: NodeOutput) => {
      if (output.status === 'running') {
        executionOrder.push(nodeId)
      }
    })

    await executeCanvas(callback)

    // A must run before B
    expect(executionOrder).toEqual(['A', 'B'])
  })
})
