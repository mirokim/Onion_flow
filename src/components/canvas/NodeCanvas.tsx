import { useCallback, useMemo, useState, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCanvasStore } from '@/stores/canvasStore'
import { useProjectStore } from '@/stores/projectStore'
import { BaseNode } from '@nodes/_base/BaseNode'
import { GroupNode } from '@nodes/group/GroupNode'
import { CanvasToolbar } from './CanvasToolbar'
import { CanvasContextMenu } from './CanvasContextMenu'
import { NODE_CATEGORY_COLORS, type NodeTypeDefinition } from '@nodes/index'
import type { CanvasNodeCategory } from '@/types'
import { toast } from '@/components/common/Toast'

const nodeTypes = {
  baseNode: BaseNode,
  groupNode: GroupNode,
}

function NodeCanvasInner() {
  const currentProject = useProjectStore(s => s.currentProject)

  const addNode = useCanvasStore(s => s.addNode)
  const removeNode = useCanvasStore(s => s.removeNode)
  const updateNodePosition = useCanvasStore(s => s.updateNodePosition)
  const updateNodeSize = useCanvasStore(s => s.updateNodeSize)
  const connectNodesAction = useCanvasStore(s => s.connectNodes)
  const disconnectWire = useCanvasStore(s => s.disconnectWire)
  const enterDepth = useCanvasStore(s => s.enterDepth)
  const addNodeToGroup = useCanvasStore(s => s.addNodeToGroup)
  const removeNodeFromGroup = useCanvasStore(s => s.removeNodeFromGroup)

  const storeNodes = useCanvasStore(s => s.nodes)
  const storeWires = useCanvasStore(s => s.wires)
  const currentDepthPath = useCanvasStore(s => s.currentDepthPath)

  const parentId = currentDepthPath.length > 0
    ? currentDepthPath[currentDepthPath.length - 1]
    : null

  const canvasNodes = useMemo(
    () => storeNodes.filter(n => n.parentCanvasId === parentId),
    [storeNodes, parentId],
  )
  const canvasWires = useMemo(
    () => storeWires.filter(w => w.parentCanvasId === parentId),
    [storeWires, parentId],
  )

  // Group node IDs at current depth (for context menu)
  const groupNodeIds = useMemo(
    () => canvasNodes.filter(n => n.type === 'group').map(n => n.id),
    [canvasNodes],
  )

  const rfNodes: Node[] = useMemo(() => {
    // Groups must come before their children for xyflow to render correctly
    const groups: Node[] = []
    const regular: Node[] = []

    for (const n of canvasNodes) {
      const isGroup = n.type === 'group'
      const rfNode: Node = {
        id: n.id,
        type: isGroup ? 'groupNode' : 'baseNode',
        position: n.position,
        data: { ...n.data, nodeType: n.type, nodeId: n.id },
        // Group nodes MUST have width/height as direct Node properties for xyflow v12
        ...(isGroup
          ? {
              width: n.width || 300,
              height: n.height || 200,
              style: { width: n.width || 300, height: n.height || 200 },
            }
          : {
              ...(n.width ? { width: n.width } : {}),
              ...(n.height ? { height: n.height } : {}),
            }
        ),
        // If this node belongs to a group, set xyflow parentId — but only if the group actually exists
        ...(n.data.groupId && canvasNodes.some(g => g.id === n.data.groupId && g.type === 'group')
          ? { parentId: n.data.groupId, extent: 'parent' as const }
          : {}
        ),
      }

      if (isGroup) {
        groups.push(rfNode)
      } else {
        regular.push(rfNode)
      }
    }

    return [...groups, ...regular]
  }, [canvasNodes])

  const rfEdges: Edge[] = useMemo(() =>
    canvasWires.map(w => ({
      id: w.id,
      source: w.sourceNodeId,
      target: w.targetNodeId,
      sourceHandle: w.sourceHandle,
      targetHandle: w.targetHandle,
      animated: true,
      style: { stroke: 'var(--color-accent)', strokeWidth: 2 },
    })),
    [canvasWires],
  )

  // ── Controlled component: local selection state, Zustand = single source of truth ──
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set())

  // Merge selection into rfNodes for ReactFlow
  const rfNodesWithSelection: Node[] = useMemo(
    () => rfNodes.map(n => ({ ...n, selected: selectedNodeIds.has(n.id) })),
    [rfNodes, selectedNodeIds],
  )
  const rfEdgesWithSelection: Edge[] = useMemo(
    () => rfEdges.map(e => ({ ...e, selected: selectedEdgeIds.has(e.id) })),
    [rfEdges, selectedEdgeIds],
  )

  // Handle node changes — position/dimensions update Zustand directly, selection is local
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    let selChanged = false
    const newSel = new Set(selectedNodeIds)

    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        // Update Zustand store directly (in-memory only, DB save on dragStop)
        useCanvasStore.setState(s => ({
          nodes: s.nodes.map(n =>
            n.id === change.id ? { ...n, position: change.position! } : n,
          ),
        }))
      } else if (change.type === 'dimensions' && change.dimensions) {
        // Update Zustand store with new dimensions
        useCanvasStore.setState(s => ({
          nodes: s.nodes.map(n =>
            n.id === change.id
              ? { ...n, width: change.dimensions!.width, height: change.dimensions!.height }
              : n,
          ),
        }))
        // Persist to DB only when resize is finished
        if (!(change as any).resizing) {
          const sn = useCanvasStore.getState().nodes.find(n => n.id === change.id)
          if (sn?.type === 'group') {
            updateNodeSize(change.id, change.dimensions.width, change.dimensions.height)
          }
        }
      } else if (change.type === 'select') {
        selChanged = true
        if (change.selected) {
          newSel.add(change.id)
        } else {
          newSel.delete(change.id)
        }
      } else if (change.type === 'remove') {
        // Handled by onNodesDelete
      }
    }

    if (selChanged) setSelectedNodeIds(newSel)
  }, [selectedNodeIds, updateNodeSize])

  // Handle edge changes — selection only (remove handled by onEdgesDelete)
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    let selChanged = false
    const newSel = new Set(selectedEdgeIds)

    for (const change of changes) {
      if (change.type === 'select') {
        selChanged = true
        if (change.selected) {
          newSel.add(change.id)
        } else {
          newSel.delete(change.id)
        }
      }
    }

    if (selChanged) setSelectedEdgeIds(newSel)
  }, [selectedEdgeIds])

  // ── Context Menu State ──
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; canvasX: number; canvasY: number
  } | null>(null)
  const [contextTargetNodeId, setContextTargetNodeId] = useState<string | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setContextTargetNodeId(null)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      canvasX: flowPos.x,
      canvasY: flowPos.y,
    })
  }, [screenToFlowPosition])

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setContextTargetNodeId(node.id)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      canvasX: flowPos.x,
      canvasY: flowPos.y,
    })
  }, [screenToFlowPosition])

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
    setContextTargetNodeId(null)
  }, [])

  // ── Handlers ──

  const handleAddNodeAtPosition = useCallback(
    async (def: NodeTypeDefinition, position: { x: number; y: number }) => {
      if (!currentProject) {
        toast.warning('프로젝트를 먼저 생성하거나 선택하세요.')
        return
      }
      const isGroup = def.type === 'group'
      await addNode(
        currentProject.id,
        def.type,
        position,
        def.defaultData,
        isGroup ? { width: 300, height: 200 } : undefined,
      )
    },
    [currentProject, addNode],
  )

  const handleAddGroup = useCallback(
    async (position: { x: number; y: number }) => {
      if (!currentProject) {
        toast.warning('프로젝트를 먼저 생성하거나 선택하세요.')
        return
      }
      await addNode(
        currentProject.id,
        'group',
        position,
        { label: 'Group' },
        { width: 300, height: 200 },
      )
    },
    [currentProject, addNode],
  )

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      await removeNode(nodeId)
    },
    [removeNode],
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!currentProject || !connection.source || !connection.target) return
      connectNodesAction(
        currentProject.id,
        connection.source,
        connection.target,
        connection.sourceHandle || 'out',
        connection.targetHandle || 'in',
      )
    },
    [currentProject, connectNodesAction],
  )

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      updateNodePosition(node.id, node.position)
    },
    [updateNodePosition],
  )

  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Don't enter depth for group nodes
      if ((node.data as any)?.nodeType === 'group') return
      enterDepth(node.id)
    },
    [enterDepth],
  )

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        removeNode(node.id)
      }
    },
    [removeNode],
  )

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        disconnectWire(edge.id)
      }
    },
    [disconnectWire],
  )

  const handleAddNode = useCallback(
    (def: NodeTypeDefinition) => {
      if (!currentProject) {
        toast.warning('프로젝트를 먼저 생성하거나 선택하세요.')
        return
      }
      const position = { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 }
      const isGroup = def.type === 'group'
      addNode(
        currentProject.id,
        def.type,
        position,
        def.defaultData,
        isGroup ? { width: 300, height: 200 } : undefined,
      )
    },
    [currentProject, addNode],
  )

  // Get target node's groupId for context menu
  const targetNodeGroupId = useMemo(() => {
    if (!contextTargetNodeId) return null
    const node = canvasNodes.find(n => n.id === contextTargetNodeId)
    return node?.data?.groupId || null
  }, [contextTargetNodeId, canvasNodes])

  return (
    <div ref={reactFlowWrapper} className="relative w-full h-full">
      <ReactFlow
        nodes={rfNodesWithSelection}
        edges={rfEdgesWithSelection}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
        className="bg-bg-primary"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border)" />
        <Controls className="!bg-bg-surface !border-border !shadow-md" />
        <MiniMap
          nodeColor={(n) => {
            const nodeType = (n.data as any)?.nodeType
            if (!nodeType) return '#999'
            if (nodeType === 'group') return NODE_CATEGORY_COLORS.structure
            const catMap: Record<string, CanvasNodeCategory> = {
              character: 'context', event: 'context', wiki: 'context',
              personality: 'context', appearance: 'context', memory: 'context',
              pov: 'direction', pacing: 'direction', style_transfer: 'direction',
              storyteller: 'processing', summarizer: 'processing',
              emotion_tracker: 'detector', foreshadow_detector: 'detector', conflict_defense: 'detector',
              save_story: 'output',
            }
            const cat = catMap[nodeType] || 'special'
            return NODE_CATEGORY_COLORS[cat] || '#999'
          }}
          className="!bg-bg-secondary !border-border"
          maskColor="rgba(0,0,0,0.3)"
        />
      </ReactFlow>
      <CanvasToolbar onAddNode={handleAddNode} />

      {/* Right-click context menu */}
      <CanvasContextMenu
        position={contextMenu}
        targetNodeId={contextTargetNodeId}
        targetNodeGroupId={targetNodeGroupId}
        groupNodeIds={groupNodeIds}
        onAddNode={handleAddNodeAtPosition}
        onAddGroup={handleAddGroup}
        onDeleteNode={handleDeleteNode}
        onAddToGroup={addNodeToGroup}
        onRemoveFromGroup={removeNodeFromGroup}
        onClose={closeContextMenu}
      />
    </div>
  )
}

export function NodeCanvas() {
  return (
    <ReactFlowProvider>
      <NodeCanvasInner />
    </ReactFlowProvider>
  )
}
