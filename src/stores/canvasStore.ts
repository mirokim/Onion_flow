import { create } from 'zustand'
import { getAdapter } from '@/db/storageAdapter'
import type { CanvasNode, CanvasWire, CanvasNodeType } from '@/types'
import { generateId } from '@/lib/utils'
import { nowUTC } from '@/lib/dateUtils'

export interface NodeOutput {
  status: 'idle' | 'queued' | 'running' | 'completed' | 'error'
  content: string
  error?: string
}

interface CanvasState {
  nodes: CanvasNode[]
  wires: CanvasWire[]
  currentDepthPath: string[] // [rootId, ..., currentParentCanvasId]
  selectedNodeId: string | null
  loading: boolean

  // Execution state
  nodeOutputs: Record<string, NodeOutput>
  isExecuting: boolean

  // Load
  loadCanvas: (projectId: string) => Promise<void>

  // CRUD Nodes
  addNode: (projectId: string, type: CanvasNodeType, position: { x: number; y: number }, defaultData?: Record<string, any>, size?: { width: number; height: number }) => Promise<CanvasNode>
  removeNode: (id: string) => Promise<void>
  updateNodeData: (id: string, data: Record<string, any>) => Promise<void>
  updateNodePosition: (id: string, position: { x: number; y: number }) => Promise<void>
  updateNodeSize: (id: string, width: number, height: number) => Promise<void>
  selectNode: (id: string | null) => void

  // CRUD Wires
  connectNodes: (projectId: string, sourceNodeId: string, targetNodeId: string, sourceHandle: string, targetHandle: string) => Promise<CanvasWire>
  disconnectWire: (wireId: string) => Promise<void>

  // Depth Navigation
  enterDepth: (nodeId: string) => Promise<void>
  exitDepth: () => Promise<void>
  warpToDepth: (index: number) => Promise<void>
  getCurrentParentCanvasId: () => string | null

  // Serialization
  exportCanvas: () => { nodes: CanvasNode[]; wires: CanvasWire[]; depthPath: string[] }

  // Group
  addNodeToGroup: (nodeId: string, groupId: string) => Promise<void>
  removeNodeFromGroup: (nodeId: string) => Promise<void>

  // Execution
  setNodeOutput: (nodeId: string, output: NodeOutput) => void
  clearNodeOutputs: () => void
  setIsExecuting: (v: boolean) => void

  // Template
  createDefaultTemplate: (projectId: string) => Promise<void>

  // Helpers
  getNodesAtCurrentDepth: () => CanvasNode[]
  getWiresAtCurrentDepth: () => CanvasWire[]
  getUpstreamNodes: (nodeId: string) => CanvasNode[]
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  wires: [],
  currentDepthPath: [],
  selectedNodeId: null,
  loading: false,
  nodeOutputs: {},
  isExecuting: false,

  loadCanvas: async (projectId: string) => {
    set({ loading: true })
    const adapter = getAdapter()
    const [nodes, wires] = await Promise.all([
      adapter.fetchCanvasNodes(projectId),
      adapter.fetchCanvasWires(projectId),
    ])
    set({ nodes, wires, currentDepthPath: [], selectedNodeId: null, loading: false })
  },

  addNode: async (projectId, type, position, defaultData, size) => {
    const parentCanvasId = get().getCurrentParentCanvasId()
    const node: CanvasNode = {
      id: generateId(),
      projectId,
      parentCanvasId,
      type,
      position,
      data: defaultData ? { ...defaultData } : {},
      ...(size ? { width: size.width, height: size.height } : {}),
      createdAt: nowUTC(),
      updatedAt: nowUTC(),
    }
    await getAdapter().insertCanvasNode(node)
    set(s => ({ nodes: [...s.nodes, node] }))
    return node
  },

  removeNode: async (id: string) => {
    await getAdapter().deleteCanvasNode(id)
    set(s => ({
      nodes: s.nodes.filter(n => n.id !== id && n.parentCanvasId !== id),
      wires: s.wires.filter(w => w.sourceNodeId !== id && w.targetNodeId !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    }))
  },

  updateNodeData: async (id, data) => {
    const node = get().nodes.find(n => n.id === id)
    if (!node) return
    const merged = { ...node.data, ...data }
    await getAdapter().updateCanvasNode(id, { data: merged })
    set(s => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, data: merged, updatedAt: nowUTC() } : n),
    }))
  },

  updateNodePosition: async (id, position) => {
    await getAdapter().updateCanvasNode(id, { position })
    set(s => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, position, updatedAt: nowUTC() } : n),
    }))
  },

  updateNodeSize: async (id, width, height) => {
    await getAdapter().updateCanvasNode(id, { width, height })
    set(s => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, width, height, updatedAt: nowUTC() } : n),
    }))
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  connectNodes: async (projectId, sourceNodeId, targetNodeId, sourceHandle, targetHandle) => {
    // Prevent duplicate connections
    const existing = get().wires.find(w =>
      w.sourceNodeId === sourceNodeId &&
      w.targetNodeId === targetNodeId &&
      w.sourceHandle === sourceHandle &&
      w.targetHandle === targetHandle
    )
    if (existing) return existing

    const parentCanvasId = get().getCurrentParentCanvasId()
    const wire: CanvasWire = {
      id: generateId(),
      projectId,
      parentCanvasId,
      sourceNodeId,
      targetNodeId,
      sourceHandle,
      targetHandle,
    }
    // Optimistic update: add to store immediately so wire renders right away
    set(s => ({ wires: [...s.wires, wire] }))
    try {
      await getAdapter().insertCanvasWire(wire)
    } catch (err) {
      // Rollback on DB error
      console.error('[canvasStore] Failed to persist wire:', err)
      set(s => ({ wires: s.wires.filter(w => w.id !== wire.id) }))
    }
    return wire
  },

  disconnectWire: async (wireId) => {
    await getAdapter().deleteCanvasWire(wireId)
    set(s => ({ wires: s.wires.filter(w => w.id !== wireId) }))
  },

  enterDepth: async (nodeId: string) => {
    set(s => ({ currentDepthPath: [...s.currentDepthPath, nodeId], selectedNodeId: null }))
  },

  exitDepth: async () => {
    set(s => ({
      currentDepthPath: s.currentDepthPath.slice(0, -1),
      selectedNodeId: null,
    }))
  },

  warpToDepth: async (index: number) => {
    set(s => ({
      currentDepthPath: s.currentDepthPath.slice(0, index),
      selectedNodeId: null,
    }))
  },

  getCurrentParentCanvasId: () => {
    const { currentDepthPath } = get()
    return currentDepthPath.length > 0 ? currentDepthPath[currentDepthPath.length - 1] : null
  },

  exportCanvas: () => {
    const { nodes, wires, currentDepthPath } = get()
    return { nodes, wires, depthPath: currentDepthPath }
  },

  addNodeToGroup: async (nodeId: string, groupId: string) => {
    const node = get().nodes.find(n => n.id === nodeId)
    const groupNode = get().nodes.find(n => n.id === groupId)
    if (!node || !groupNode) return

    // Convert absolute position to relative (subtract group position)
    const relativePosition = {
      x: node.position.x - groupNode.position.x,
      y: node.position.y - groupNode.position.y,
    }

    const merged = { ...node.data, groupId }
    await getAdapter().updateCanvasNode(nodeId, { data: merged, position: relativePosition })
    set(s => ({
      nodes: s.nodes.map(n => n.id === nodeId
        ? { ...n, data: merged, position: relativePosition, updatedAt: nowUTC() }
        : n),
    }))
  },

  removeNodeFromGroup: async (nodeId: string) => {
    const node = get().nodes.find(n => n.id === nodeId)
    if (!node) return
    const groupId = node.data.groupId as string | undefined
    const groupNode = groupId ? get().nodes.find(n => n.id === groupId) : null

    // Convert relative position back to absolute (add group position)
    const absolutePosition = groupNode
      ? { x: node.position.x + groupNode.position.x, y: node.position.y + groupNode.position.y }
      : node.position

    const { groupId: _, ...rest } = node.data
    await getAdapter().updateCanvasNode(nodeId, { data: rest, position: absolutePosition })
    set(s => ({
      nodes: s.nodes.map(n => n.id === nodeId
        ? { ...n, data: rest, position: absolutePosition, updatedAt: nowUTC() }
        : n),
    }))
  },

  setNodeOutput: (nodeId, output) => {
    set(s => ({
      nodeOutputs: { ...s.nodeOutputs, [nodeId]: output },
    }))
  },

  clearNodeOutputs: () => set({ nodeOutputs: {} }),

  setIsExecuting: (isExecuting) => set({ isExecuting }),

  getNodesAtCurrentDepth: () => {
    const { nodes } = get()
    const parentId = get().getCurrentParentCanvasId()
    return nodes.filter(n => n.parentCanvasId === parentId)
  },

  getWiresAtCurrentDepth: () => {
    const { wires } = get()
    const parentId = get().getCurrentParentCanvasId()
    return wires.filter(w => w.parentCanvasId === parentId)
  },

  getUpstreamNodes: (nodeId: string) => {
    const { nodes, wires } = get()
    const visited = new Set<string>()
    const result: CanvasNode[] = []

    const traverse = (id: string) => {
      if (visited.has(id)) return
      visited.add(id)
      const incoming = wires.filter(w => w.targetNodeId === id)
      for (const wire of incoming) {
        const sourceNode = nodes.find(n => n.id === wire.sourceNodeId)
        if (sourceNode) {
          result.push(sourceNode)
          traverse(sourceNode.id)
        }
      }
    }
    traverse(nodeId)
    return result
  },

  createDefaultTemplate: async (projectId: string) => {
    const { addNode, connectNodes } = get()

    // 7 nodes: personality, appearance, memory, character, event, storyteller, save_story
    const personality = await addNode(projectId, 'personality', { x: 0, y: 0 }, { text: '', label: '성격' })
    const appearance = await addNode(projectId, 'appearance', { x: 0, y: 120 }, { text: '', label: '외모' })
    const memory = await addNode(projectId, 'memory', { x: 0, y: 240 }, { text: '', label: '기억' })
    const character = await addNode(projectId, 'character', { x: 280, y: 80 }, { label: 'Character' })
    const event = await addNode(projectId, 'event', { x: 280, y: 280 }, { text: '', label: 'Event' })
    const storyteller = await addNode(projectId, 'storyteller', { x: 560, y: 140 }, { provider: null, label: 'AI Storyteller' })
    const saveStory = await addNode(projectId, 'save_story', { x: 840, y: 140 }, { filename: 'story.md', label: 'Save Story' })

    // 6 wires
    await connectNodes(projectId, personality.id, character.id, 'out', 'personality')
    await connectNodes(projectId, appearance.id, character.id, 'out', 'appearance')
    await connectNodes(projectId, memory.id, character.id, 'out', 'memory')
    await connectNodes(projectId, character.id, storyteller.id, 'out', 'context')
    await connectNodes(projectId, event.id, storyteller.id, 'out', 'context')
    await connectNodes(projectId, storyteller.id, saveStory.id, 'out', 'story')
  },
}))
