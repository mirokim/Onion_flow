/**
 * Undo-aware wrapper functions for canvas store mutations.
 * Each function performs the action and pushes an undo entry to undoStore.
 */
import { useCanvasStore } from './canvasStore'
import { useUndoStore } from './undoStore'
import { getAdapter } from '@/db/storageAdapter'
import type { CanvasNode, CanvasWire, CanvasNodeType } from '@/types'

/**
 * Add node with undo. Undo = remove the node. Redo = re-insert.
 */
export async function addNodeWithUndo(
  projectId: string,
  type: CanvasNodeType,
  position: { x: number; y: number },
  defaultData?: Record<string, any>,
  size?: { width: number; height: number },
): Promise<CanvasNode> {
  const node = await useCanvasStore.getState().addNode(projectId, type, position, defaultData, size)
  const snapshot = { ...node, data: { ...node.data } }

  useUndoStore.getState().pushUndo({
    label: `노드 추가: ${type}`,
    context: 'canvas',
    undo: async () => {
      await useCanvasStore.getState().removeNode(snapshot.id)
    },
    redo: async () => {
      await getAdapter().insertCanvasNode(snapshot)
      useCanvasStore.setState(s => ({ nodes: [...s.nodes, snapshot] }))
    },
  })

  return node
}

/**
 * Remove node with undo. Captures the node + connected wires + child nodes before deletion.
 */
export async function removeNodeWithUndo(nodeId: string): Promise<void> {
  const state = useCanvasStore.getState()
  const node = state.nodes.find(n => n.id === nodeId)
  if (!node) return

  // Snapshot before deletion
  const snapshotNode: CanvasNode = { ...node, data: { ...node.data } }
  const snapshotWires: CanvasWire[] = state.wires
    .filter(w => w.sourceNodeId === nodeId || w.targetNodeId === nodeId)
    .map(w => ({ ...w }))
  const snapshotChildren: CanvasNode[] = state.nodes
    .filter(n => n.parentCanvasId === nodeId)
    .map(n => ({ ...n, data: { ...n.data } }))

  await useCanvasStore.getState().removeNode(nodeId)

  useUndoStore.getState().pushUndo({
    label: `노드 삭제: ${node.data.label || node.type}`,
    context: 'canvas',
    undo: async () => {
      const adapter = getAdapter()
      await adapter.insertCanvasNode(snapshotNode)
      for (const child of snapshotChildren) {
        await adapter.insertCanvasNode(child)
      }
      for (const wire of snapshotWires) {
        await adapter.insertCanvasWire(wire)
      }
      useCanvasStore.setState(s => ({
        nodes: [...s.nodes, snapshotNode, ...snapshotChildren],
        wires: [...s.wires, ...snapshotWires],
      }))
    },
    redo: async () => {
      await useCanvasStore.getState().removeNode(nodeId)
    },
  })
}

/**
 * Connect nodes with undo. Undo = disconnect. Redo = re-insert wire.
 */
export async function connectNodesWithUndo(
  projectId: string,
  sourceNodeId: string,
  targetNodeId: string,
  sourceHandle: string,
  targetHandle: string,
): Promise<CanvasWire> {
  const wire = await useCanvasStore.getState().connectNodes(
    projectId, sourceNodeId, targetNodeId, sourceHandle, targetHandle,
  )
  const snapshot: CanvasWire = { ...wire }

  useUndoStore.getState().pushUndo({
    label: '와이어 연결',
    context: 'canvas',
    undo: async () => {
      await useCanvasStore.getState().disconnectWire(snapshot.id)
    },
    redo: async () => {
      await getAdapter().insertCanvasWire(snapshot)
      useCanvasStore.setState(s => ({ wires: [...s.wires, snapshot] }))
    },
  })

  return wire
}

/**
 * Disconnect wire with undo. Captures wire before deletion.
 */
export async function disconnectWireWithUndo(wireId: string): Promise<void> {
  const wire = useCanvasStore.getState().wires.find(w => w.id === wireId)
  if (!wire) return
  const snapshot: CanvasWire = { ...wire }

  await useCanvasStore.getState().disconnectWire(wireId)

  useUndoStore.getState().pushUndo({
    label: '와이어 해제',
    context: 'canvas',
    undo: async () => {
      await getAdapter().insertCanvasWire(snapshot)
      useCanvasStore.setState(s => ({ wires: [...s.wires, snapshot] }))
    },
    redo: async () => {
      await useCanvasStore.getState().disconnectWire(snapshot.id)
    },
  })
}

/**
 * Batch move nodes with undo. Called from onNodeDragStop.
 */
export async function updateNodePositionsBatchWithUndo(
  moves: Array<{ nodeId: string; oldPosition: { x: number; y: number }; newPosition: { x: number; y: number } }>,
): Promise<void> {
  // Persist all new positions to DB
  for (const m of moves) {
    await useCanvasStore.getState().updateNodePosition(m.nodeId, m.newPosition)
  }

  useUndoStore.getState().pushUndo({
    label: `노드 이동 (${moves.length})`,
    context: 'canvas',
    undo: async () => {
      for (const m of moves) {
        await useCanvasStore.getState().updateNodePosition(m.nodeId, m.oldPosition)
      }
    },
    redo: async () => {
      for (const m of moves) {
        await useCanvasStore.getState().updateNodePosition(m.nodeId, m.newPosition)
      }
    },
  })
}

/**
 * Update node data with undo. Captures old data before mutation.
 */
export async function updateNodeDataWithUndo(
  nodeId: string,
  newData: Record<string, any>,
): Promise<void> {
  const node = useCanvasStore.getState().nodes.find(n => n.id === nodeId)
  if (!node) return

  const oldData = { ...node.data }

  await useCanvasStore.getState().updateNodeData(nodeId, newData)

  useUndoStore.getState().pushUndo({
    label: '노드 데이터 변경',
    context: 'canvas',
    undo: async () => {
      await getAdapter().updateCanvasNode(nodeId, { data: oldData })
      useCanvasStore.setState(s => ({
        nodes: s.nodes.map(n => n.id === nodeId ? { ...n, data: oldData } : n),
      }))
    },
    redo: async () => {
      await useCanvasStore.getState().updateNodeData(nodeId, newData)
    },
  })
}

/**
 * Reconnect wire with undo (compound: delete old + create new).
 */
export async function reconnectWireWithUndo(
  projectId: string,
  oldWireId: string,
  newSource: string,
  newTarget: string,
  newSourceHandle: string,
  newTargetHandle: string,
): Promise<void> {
  const store = useCanvasStore.getState()
  const oldWire = store.wires.find(w => w.id === oldWireId)
  if (!oldWire) return
  const snapshotOldWire: CanvasWire = { ...oldWire }

  // Perform reconnection
  await store.disconnectWire(oldWireId)
  const newWire = await store.connectNodes(projectId, newSource, newTarget, newSourceHandle, newTargetHandle)
  const snapshotNewWire: CanvasWire = { ...newWire }

  useUndoStore.getState().pushUndo({
    label: '와이어 재연결',
    context: 'canvas',
    undo: async () => {
      await useCanvasStore.getState().disconnectWire(snapshotNewWire.id)
      await getAdapter().insertCanvasWire(snapshotOldWire)
      useCanvasStore.setState(s => ({ wires: [...s.wires, snapshotOldWire] }))
    },
    redo: async () => {
      await useCanvasStore.getState().disconnectWire(snapshotOldWire.id)
      await getAdapter().insertCanvasWire(snapshotNewWire)
      useCanvasStore.setState(s => ({ wires: [...s.wires, snapshotNewWire] }))
    },
  })
}
