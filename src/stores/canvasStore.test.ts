/**
 * Unit tests for canvasStore.
 * Tests: node CRUD, wire CRUD, depth navigation, group management.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useCanvasStore } from './canvasStore'
import type { CanvasNode, CanvasWire } from '@/types'

// ── Mock the storage adapter ──
vi.mock('@/db/storageAdapter', () => {
  const mockAdapter = {
    insertCanvasNode: vi.fn().mockResolvedValue(undefined),
    updateCanvasNode: vi.fn().mockResolvedValue(undefined),
    deleteCanvasNode: vi.fn().mockResolvedValue(undefined),
    fetchCanvasNodes: vi.fn().mockResolvedValue([]),
    insertCanvasWire: vi.fn().mockResolvedValue(undefined),
    deleteCanvasWire: vi.fn().mockResolvedValue(undefined),
    fetchCanvasWires: vi.fn().mockResolvedValue([]),
  }
  return {
    getAdapter: () => mockAdapter,
    __mockAdapter: mockAdapter,
  }
})

// ── Mock generateId for deterministic tests ──
let idCounter = 0
vi.mock('@/lib/utils', () => ({
  generateId: () => `test-id-${++idCounter}`,
}))

function resetStore() {
  useCanvasStore.setState({
    nodes: [],
    wires: [],
    currentDepthPath: [],
    selectedNodeId: null,
    loading: false,
  })
}

describe('canvasStore', () => {
  beforeEach(() => {
    idCounter = 0
    resetStore()
    vi.clearAllMocks()
  })

  // ── Node CRUD ──

  describe('addNode', () => {
    it('should add a node to the store with correct properties', async () => {
      const store = useCanvasStore.getState()
      const node = await store.addNode('proj-1', 'character', { x: 100, y: 200 })

      expect(node).toBeDefined()
      expect(node.id).toBe('test-id-1')
      expect(node.projectId).toBe('proj-1')
      expect(node.type).toBe('character')
      expect(node.position).toEqual({ x: 100, y: 200 })
      expect(node.parentCanvasId).toBeNull() // root level

      const state = useCanvasStore.getState()
      expect(state.nodes).toHaveLength(1)
      expect(state.nodes[0].id).toBe('test-id-1')
    })

    it('should use defaultData when provided', async () => {
      const store = useCanvasStore.getState()
      const node = await store.addNode('proj-1', 'character', { x: 0, y: 0 }, { label: 'Hero', characterId: 'c-1' })

      expect(node.data).toEqual({ label: 'Hero', characterId: 'c-1' })
    })

    it('should use empty data when no defaultData is provided', async () => {
      const store = useCanvasStore.getState()
      const node = await store.addNode('proj-1', 'event', { x: 0, y: 0 })

      expect(node.data).toEqual({})
    })

    it('should set size for group nodes', async () => {
      const store = useCanvasStore.getState()
      const node = await store.addNode('proj-1', 'group', { x: 50, y: 50 }, { label: 'G1' }, { width: 300, height: 200 })

      expect(node.width).toBe(300)
      expect(node.height).toBe(200)
      expect(node.type).toBe('group')
    })

    it('should assign parentCanvasId when inside a depth', async () => {
      // Enter depth first
      useCanvasStore.setState({ currentDepthPath: ['parent-node-1'] })

      const store = useCanvasStore.getState()
      const node = await store.addNode('proj-1', 'event', { x: 0, y: 0 })

      expect(node.parentCanvasId).toBe('parent-node-1')
    })

    it('should persist to the adapter', async () => {
      const { getAdapter } = await import('@/db/storageAdapter')
      const adapter = getAdapter()
      const store = useCanvasStore.getState()
      await store.addNode('proj-1', 'wiki', { x: 10, y: 20 })

      expect(adapter.insertCanvasNode).toHaveBeenCalledTimes(1)
      const calledWith = (adapter.insertCanvasNode as any).mock.calls[0][0]
      expect(calledWith.type).toBe('wiki')
    })
  })

  describe('removeNode', () => {
    it('should remove a node from the store', async () => {
      const store = useCanvasStore.getState()
      await store.addNode('proj-1', 'character', { x: 0, y: 0 })
      await store.addNode('proj-1', 'event', { x: 100, y: 0 })

      expect(useCanvasStore.getState().nodes).toHaveLength(2)

      await useCanvasStore.getState().removeNode('test-id-1')
      expect(useCanvasStore.getState().nodes).toHaveLength(1)
      expect(useCanvasStore.getState().nodes[0].id).toBe('test-id-2')
    })

    it('should also remove child nodes (nested in depth)', async () => {
      // Add a parent node, then a child node with parentCanvasId = parent.id
      const store = useCanvasStore.getState()
      const parent = await store.addNode('proj-1', 'storyteller', { x: 0, y: 0 })

      useCanvasStore.setState({ currentDepthPath: [parent.id] })
      await useCanvasStore.getState().addNode('proj-1', 'character', { x: 50, y: 50 })
      useCanvasStore.setState({ currentDepthPath: [] })

      expect(useCanvasStore.getState().nodes).toHaveLength(2)

      await useCanvasStore.getState().removeNode(parent.id)
      // Both parent and child with parentCanvasId = parent.id should be removed
      expect(useCanvasStore.getState().nodes).toHaveLength(0)
    })

    it('should remove associated wires', async () => {
      const store = useCanvasStore.getState()
      const n1 = await store.addNode('proj-1', 'character', { x: 0, y: 0 })
      const n2 = await store.addNode('proj-1', 'storyteller', { x: 200, y: 0 })
      await store.connectNodes('proj-1', n1.id, n2.id, 'out', 'context')

      expect(useCanvasStore.getState().wires).toHaveLength(1)

      await useCanvasStore.getState().removeNode(n1.id)
      expect(useCanvasStore.getState().wires).toHaveLength(0)
    })

    it('should clear selectedNodeId if the removed node was selected', async () => {
      const store = useCanvasStore.getState()
      const node = await store.addNode('proj-1', 'character', { x: 0, y: 0 })
      store.selectNode(node.id)

      expect(useCanvasStore.getState().selectedNodeId).toBe(node.id)

      await useCanvasStore.getState().removeNode(node.id)
      expect(useCanvasStore.getState().selectedNodeId).toBeNull()
    })
  })

  describe('updateNodeData', () => {
    it('should merge new data into existing node data', async () => {
      const store = useCanvasStore.getState()
      await store.addNode('proj-1', 'character', { x: 0, y: 0 }, { label: 'A' })

      await useCanvasStore.getState().updateNodeData('test-id-1', { characterId: 'c-5', emotion: 'happy' })

      const node = useCanvasStore.getState().nodes[0]
      expect(node.data).toEqual({ label: 'A', characterId: 'c-5', emotion: 'happy' })
    })
  })

  describe('updateNodePosition', () => {
    it('should update node position', async () => {
      const store = useCanvasStore.getState()
      await store.addNode('proj-1', 'event', { x: 0, y: 0 })

      await useCanvasStore.getState().updateNodePosition('test-id-1', { x: 500, y: 300 })

      const node = useCanvasStore.getState().nodes[0]
      expect(node.position).toEqual({ x: 500, y: 300 })
    })
  })

  // ── Wire CRUD ──

  describe('connectNodes', () => {
    it('should create a wire between two nodes', async () => {
      const store = useCanvasStore.getState()
      const n1 = await store.addNode('proj-1', 'character', { x: 0, y: 0 })
      const n2 = await store.addNode('proj-1', 'storyteller', { x: 200, y: 0 })

      const wire = await useCanvasStore.getState().connectNodes('proj-1', n1.id, n2.id, 'out', 'context')

      expect(wire).toBeDefined()
      expect(wire.sourceNodeId).toBe(n1.id)
      expect(wire.targetNodeId).toBe(n2.id)
      expect(wire.sourceHandle).toBe('out')
      expect(wire.targetHandle).toBe('context')

      expect(useCanvasStore.getState().wires).toHaveLength(1)
    })

    it('should assign parentCanvasId matching current depth', async () => {
      useCanvasStore.setState({ currentDepthPath: ['depth-parent'] })
      const store = useCanvasStore.getState()

      const wire = await store.connectNodes('proj-1', 'a', 'b', 'out', 'in')
      expect(wire.parentCanvasId).toBe('depth-parent')
    })
  })

  describe('disconnectWire', () => {
    it('should remove a wire', async () => {
      const store = useCanvasStore.getState()
      const n1 = await store.addNode('proj-1', 'character', { x: 0, y: 0 })
      const n2 = await store.addNode('proj-1', 'storyteller', { x: 200, y: 0 })
      const wire = await store.connectNodes('proj-1', n1.id, n2.id, 'out', 'in')

      expect(useCanvasStore.getState().wires).toHaveLength(1)

      await useCanvasStore.getState().disconnectWire(wire.id)
      expect(useCanvasStore.getState().wires).toHaveLength(0)
    })
  })

  // ── Depth Navigation ──

  describe('depth navigation', () => {
    it('enterDepth should push nodeId to currentDepthPath', async () => {
      const store = useCanvasStore.getState()
      await store.enterDepth('node-A')

      expect(useCanvasStore.getState().currentDepthPath).toEqual(['node-A'])

      await useCanvasStore.getState().enterDepth('node-B')
      expect(useCanvasStore.getState().currentDepthPath).toEqual(['node-A', 'node-B'])
    })

    it('exitDepth should pop the last entry', async () => {
      useCanvasStore.setState({ currentDepthPath: ['a', 'b', 'c'] })

      await useCanvasStore.getState().exitDepth()
      expect(useCanvasStore.getState().currentDepthPath).toEqual(['a', 'b'])

      await useCanvasStore.getState().exitDepth()
      expect(useCanvasStore.getState().currentDepthPath).toEqual(['a'])
    })

    it('exitDepth from root should result in empty path', async () => {
      useCanvasStore.setState({ currentDepthPath: [] })

      await useCanvasStore.getState().exitDepth()
      expect(useCanvasStore.getState().currentDepthPath).toEqual([])
    })

    it('warpToDepth should truncate path to the given index', async () => {
      useCanvasStore.setState({ currentDepthPath: ['a', 'b', 'c', 'd'] })

      await useCanvasStore.getState().warpToDepth(2)
      expect(useCanvasStore.getState().currentDepthPath).toEqual(['a', 'b'])
    })

    it('warpToDepth(0) should go to root', async () => {
      useCanvasStore.setState({ currentDepthPath: ['a', 'b', 'c'] })

      await useCanvasStore.getState().warpToDepth(0)
      expect(useCanvasStore.getState().currentDepthPath).toEqual([])
    })

    it('getCurrentParentCanvasId should return last element of depth path', () => {
      useCanvasStore.setState({ currentDepthPath: ['x', 'y', 'z'] })
      expect(useCanvasStore.getState().getCurrentParentCanvasId()).toBe('z')
    })

    it('getCurrentParentCanvasId should return null at root', () => {
      useCanvasStore.setState({ currentDepthPath: [] })
      expect(useCanvasStore.getState().getCurrentParentCanvasId()).toBeNull()
    })

    it('enterDepth should clear selectedNodeId', async () => {
      useCanvasStore.setState({ selectedNodeId: 'some-node' })

      await useCanvasStore.getState().enterDepth('node-X')
      expect(useCanvasStore.getState().selectedNodeId).toBeNull()
    })
  })

  // ── Depth Filtering ──

  describe('getNodesAtCurrentDepth / getWiresAtCurrentDepth', () => {
    it('should return only root-level nodes at root depth', () => {
      const rootNode: CanvasNode = {
        id: 'r1', projectId: 'p', parentCanvasId: null,
        type: 'character', position: { x: 0, y: 0 }, data: {},
        createdAt: 1, updatedAt: 1,
      }
      const childNode: CanvasNode = {
        id: 'c1', projectId: 'p', parentCanvasId: 'r1',
        type: 'event', position: { x: 0, y: 0 }, data: {},
        createdAt: 1, updatedAt: 1,
      }

      useCanvasStore.setState({ nodes: [rootNode, childNode], currentDepthPath: [] })

      const filtered = useCanvasStore.getState().getNodesAtCurrentDepth()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('r1')
    })

    it('should return child nodes when inside a depth', () => {
      const rootNode: CanvasNode = {
        id: 'r1', projectId: 'p', parentCanvasId: null,
        type: 'character', position: { x: 0, y: 0 }, data: {},
        createdAt: 1, updatedAt: 1,
      }
      const childNode: CanvasNode = {
        id: 'c1', projectId: 'p', parentCanvasId: 'r1',
        type: 'event', position: { x: 0, y: 0 }, data: {},
        createdAt: 1, updatedAt: 1,
      }

      useCanvasStore.setState({ nodes: [rootNode, childNode], currentDepthPath: ['r1'] })

      const filtered = useCanvasStore.getState().getNodesAtCurrentDepth()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('c1')
    })

    it('should filter wires by current depth', () => {
      const rootWire: CanvasWire = {
        id: 'w1', projectId: 'p', parentCanvasId: null,
        sourceNodeId: 'a', targetNodeId: 'b', sourceHandle: 'out', targetHandle: 'in',
      }
      const childWire: CanvasWire = {
        id: 'w2', projectId: 'p', parentCanvasId: 'parent-1',
        sourceNodeId: 'c', targetNodeId: 'd', sourceHandle: 'out', targetHandle: 'in',
      }

      useCanvasStore.setState({ wires: [rootWire, childWire], currentDepthPath: [] })
      expect(useCanvasStore.getState().getWiresAtCurrentDepth()).toHaveLength(1)
      expect(useCanvasStore.getState().getWiresAtCurrentDepth()[0].id).toBe('w1')

      useCanvasStore.setState({ currentDepthPath: ['parent-1'] })
      expect(useCanvasStore.getState().getWiresAtCurrentDepth()).toHaveLength(1)
      expect(useCanvasStore.getState().getWiresAtCurrentDepth()[0].id).toBe('w2')
    })
  })

  // ── Group Management ──

  describe('group management', () => {
    it('addNodeToGroup should set groupId in node data', async () => {
      const store = useCanvasStore.getState()
      const group = await store.addNode('proj-1', 'group', { x: 0, y: 0 }, { label: 'G1' }, { width: 300, height: 200 })
      const node = await store.addNode('proj-1', 'character', { x: 50, y: 50 })

      await useCanvasStore.getState().addNodeToGroup(node.id, group.id)

      const updated = useCanvasStore.getState().nodes.find(n => n.id === node.id)!
      expect(updated.data.groupId).toBe(group.id)
    })

    it('removeNodeFromGroup should clear groupId from node data', async () => {
      const store = useCanvasStore.getState()
      const group = await store.addNode('proj-1', 'group', { x: 0, y: 0 }, { label: 'G1' }, { width: 300, height: 200 })
      const node = await store.addNode('proj-1', 'character', { x: 50, y: 50 })

      await useCanvasStore.getState().addNodeToGroup(node.id, group.id)
      expect(useCanvasStore.getState().nodes.find(n => n.id === node.id)!.data.groupId).toBe(group.id)

      await useCanvasStore.getState().removeNodeFromGroup(node.id)
      const updated = useCanvasStore.getState().nodes.find(n => n.id === node.id)!
      expect(updated.data.groupId).toBeUndefined()
    })

    it('removing a group node should also remove wires connected to it', async () => {
      const store = useCanvasStore.getState()
      const group = await store.addNode('proj-1', 'group', { x: 0, y: 0 }, { label: 'G1' })
      const other = await store.addNode('proj-1', 'character', { x: 200, y: 0 })

      // Even groups can have wires in theory (unusual but possible)
      await store.connectNodes('proj-1', group.id, other.id, 'out', 'in')

      expect(useCanvasStore.getState().wires).toHaveLength(1)

      await useCanvasStore.getState().removeNode(group.id)
      expect(useCanvasStore.getState().wires).toHaveLength(0)
    })
  })

  // ── Upstream Nodes ──

  describe('getUpstreamNodes', () => {
    it('should return all upstream nodes connected by wires', async () => {
      const store = useCanvasStore.getState()
      const char = await store.addNode('proj-1', 'character', { x: 0, y: 0 })
      const event = await store.addNode('proj-1', 'event', { x: 0, y: 100 })
      const pov = await store.addNode('proj-1', 'pov', { x: 200, y: 50 })
      const storyteller = await store.addNode('proj-1', 'storyteller', { x: 400, y: 50 })

      await store.connectNodes('proj-1', char.id, pov.id, 'out', 'in')
      await store.connectNodes('proj-1', event.id, pov.id, 'out', 'in')
      await store.connectNodes('proj-1', pov.id, storyteller.id, 'out', 'context')

      const upstream = useCanvasStore.getState().getUpstreamNodes(storyteller.id)

      // Should include pov, character, event (all upstream of storyteller)
      const upstreamIds = upstream.map(n => n.id).sort()
      expect(upstreamIds).toEqual([char.id, event.id, pov.id].sort())
    })

    it('should handle circular references without infinite loop', async () => {
      const store = useCanvasStore.getState()
      const a = await store.addNode('proj-1', 'character', { x: 0, y: 0 })
      const b = await store.addNode('proj-1', 'event', { x: 100, y: 0 })

      await store.connectNodes('proj-1', a.id, b.id, 'out', 'in')
      await store.connectNodes('proj-1', b.id, a.id, 'out', 'in')

      // Should not throw or loop infinitely
      // In a cycle a↔b, both are upstream of each other
      const upstream = useCanvasStore.getState().getUpstreamNodes(a.id)
      expect(upstream).toHaveLength(2)
      const ids = upstream.map(n => n.id).sort()
      expect(ids).toEqual([a.id, b.id].sort())
    })

    it('should return empty array for node with no upstream', async () => {
      const store = useCanvasStore.getState()
      const node = await store.addNode('proj-1', 'character', { x: 0, y: 0 })

      const upstream = useCanvasStore.getState().getUpstreamNodes(node.id)
      expect(upstream).toHaveLength(0)
    })
  })

  // ── Export ──

  describe('exportCanvas', () => {
    it('should return all nodes, wires, and depth path', async () => {
      const store = useCanvasStore.getState()
      await store.addNode('proj-1', 'character', { x: 0, y: 0 })
      await store.addNode('proj-1', 'event', { x: 100, y: 0 })
      const n1 = useCanvasStore.getState().nodes[0]
      const n2 = useCanvasStore.getState().nodes[1]
      await store.connectNodes('proj-1', n1.id, n2.id, 'out', 'in')

      useCanvasStore.setState({ currentDepthPath: ['test-depth'] })

      const exported = useCanvasStore.getState().exportCanvas()
      expect(exported.nodes).toHaveLength(2)
      expect(exported.wires).toHaveLength(1)
      expect(exported.depthPath).toEqual(['test-depth'])
    })
  })

  // ── Default Template ──

  describe('createDefaultTemplate', () => {
    it('should create 7 nodes and 6 wires', async () => {
      await useCanvasStore.getState().createDefaultTemplate('proj-1')

      const state = useCanvasStore.getState()
      expect(state.nodes).toHaveLength(7)
      expect(state.wires).toHaveLength(6)
    })

    it('should create the correct node types', async () => {
      await useCanvasStore.getState().createDefaultTemplate('proj-1')

      const types = useCanvasStore.getState().nodes.map(n => n.type).sort()
      expect(types).toEqual([
        'appearance', 'character', 'event', 'memory',
        'personality', 'save_story', 'storyteller',
      ])
    })

    it('should wire personality/appearance/memory → character', async () => {
      await useCanvasStore.getState().createDefaultTemplate('proj-1')

      const state = useCanvasStore.getState()
      const characterNode = state.nodes.find(n => n.type === 'character')!
      const incomingToCharacter = state.wires.filter(w => w.targetNodeId === characterNode.id)

      expect(incomingToCharacter).toHaveLength(3)
      const targetHandles = incomingToCharacter.map(w => w.targetHandle).sort()
      expect(targetHandles).toEqual(['appearance', 'memory', 'personality'])
    })

    it('should wire character + event → storyteller → save_story', async () => {
      await useCanvasStore.getState().createDefaultTemplate('proj-1')

      const state = useCanvasStore.getState()
      const storytellerNode = state.nodes.find(n => n.type === 'storyteller')!
      const saveStoryNode = state.nodes.find(n => n.type === 'save_story')!

      const incomingToStoryteller = state.wires.filter(w => w.targetNodeId === storytellerNode.id)
      expect(incomingToStoryteller).toHaveLength(2)

      const incomingToSaveStory = state.wires.filter(w => w.targetNodeId === saveStoryNode.id)
      expect(incomingToSaveStory).toHaveLength(1)
      expect(incomingToSaveStory[0].sourceNodeId).toBe(storytellerNode.id)
      expect(incomingToSaveStory[0].targetHandle).toBe('story')
    })
  })

  // ── Select Node ──

  describe('selectNode', () => {
    it('should set selectedNodeId', () => {
      useCanvasStore.getState().selectNode('node-123')
      expect(useCanvasStore.getState().selectedNodeId).toBe('node-123')
    })

    it('should clear selection when null is passed', () => {
      useCanvasStore.getState().selectNode('node-123')
      useCanvasStore.getState().selectNode(null)
      expect(useCanvasStore.getState().selectedNodeId).toBeNull()
    })
  })
})
