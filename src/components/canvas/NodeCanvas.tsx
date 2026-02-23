import { useCallback, useMemo, useState, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  type Connection,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useProjectStore } from '@/stores/projectStore'
import { BaseNode } from '@nodes/_base/BaseNode'
import { GroupNode } from '@nodes/group/GroupNode'
import { CanvasToolbar } from './CanvasToolbar'
import { CanvasContextMenu } from './CanvasContextMenu'
import { getNodeDefinition, type NodeTypeDefinition } from '@nodes/index'
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
        // ⚠ Do NOT feed measured dimensions back into Zustand for every node!
        // Doing so creates new node objects → ReactFlow re-measures → infinite loop,
        // which also prevents handle-bounds from stabilising → edges never render.
        // ReactFlow tracks measured dimensions internally; we only persist group
        // resize to the DB when the user finishes resizing.
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
  const [contextMenuInitialSubmenu, setContextMenuInitialSubmenu] = useState<'add-node' | null>(null)
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition } = useReactFlow()

  // ── Right-click drag detection (suppress context menu after panning) ──
  const panStartRef = useRef<{ x: number; y: number } | null>(null)

  // ── Edge reconnection tracking ──
  const reconnectSuccessful = useRef(false)

  const onPaneContextMenu = useCallback((event: MouseEvent | React.MouseEvent) => {
    event.preventDefault()
    // If mouse moved >5px from right-click start, this was a pan drag — don't show menu
    if (panStartRef.current) {
      const dx = event.clientX - panStartRef.current.x
      const dy = event.clientY - panStartRef.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 5) {
        panStartRef.current = null
        return
      }
    }
    panStartRef.current = null

    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setContextMenuInitialSubmenu(null)
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
    setContextMenuInitialSubmenu(null)
    setContextTargetNodeId(node.id)
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      canvasX: flowPos.x,
      canvasY: flowPos.y,
    })
  }, [screenToFlowPosition])

  // Right-click on edge → quick delete (no context menu needed)
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault()
    disconnectWire(edge.id)
  }, [disconnectWire])

  // Single click on empty canvas → close context menu
  const onPaneClick = useCallback(() => {
    closeContextMenu()
  }, [])

  // Double-click on empty canvas → open add-node menu directly
  // (using wrapper div onDoubleClick for reliability — onPaneClick.detail is unreliable)
  const handleCanvasDoubleClick = useCallback((event: React.MouseEvent) => {
    // Skip if double-click landed on a node or control
    const target = event.target as HTMLElement
    if (target.closest('.react-flow__node') || target.closest('.react-flow__controls')) return
    const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setContextMenuInitialSubmenu('add-node')
    setContextTargetNodeId(null)
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
    setContextMenuInitialSubmenu(null)
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

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    if (!connection.source || !connection.target) return false
    if (connection.source === connection.target) return false

    // Check for duplicate wires
    const sourceHandle = connection.sourceHandle ?? null
    const targetHandle = connection.targetHandle ?? null
    const exists = storeWires.some(w =>
      w.sourceNodeId === connection.source &&
      w.targetNodeId === connection.target &&
      w.sourceHandle === sourceHandle &&
      w.targetHandle === targetHandle
    )
    if (exists) return false

    return true
  }, [storeWires])

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

  // Node double-click depth entry disabled — hierarchy will be redesigned later
  const onNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, _node: Node) => {
      // noop: depth hierarchy disabled
    },
    [],
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

  // ── Edge reconnection: drag handle to reconnect or drop on empty space to disconnect ──
  const handleReconnectStart = useCallback(() => {
    reconnectSuccessful.current = false
  }, [])

  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      reconnectSuccessful.current = true
      if (!currentProject || !newConnection.source || !newConnection.target) return
      // Delete old wire, create new one
      disconnectWire(oldEdge.id)
      connectNodesAction(
        currentProject.id,
        newConnection.source,
        newConnection.target,
        newConnection.sourceHandle || 'out',
        newConnection.targetHandle || 'in',
      )
    },
    [currentProject, disconnectWire, connectNodesAction],
  )

  const handleReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge) => {
      // If edge was dropped on empty space (not reconnected), disconnect it
      if (!reconnectSuccessful.current) {
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
    <div
      ref={reactFlowWrapper}
      className="absolute inset-0"
      onMouseDownCapture={(e) => {
        if (e.button === 2) panStartRef.current = { x: e.clientX, y: e.clientY }
      }}
      onDoubleClick={handleCanvasDoubleClick}
    >
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
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneClick={onPaneClick}
        isValidConnection={isValidConnection}
        // ── ComfyUI-style mouse interactions ──
        panOnDrag={[1, 2]}
        selectionOnDrag={true}
        selectionMode={SelectionMode.Partial}
        zoomOnDoubleClick={false}
        snapToGrid={true}
        snapGrid={[20, 20]}
        // ── Edge reconnection ──
        edgesReconnectable={true}
        onReconnect={handleReconnect}
        onReconnectStart={handleReconnectStart}
        onReconnectEnd={handleReconnectEnd}
        reconnectRadius={20}
        elevateEdgesOnSelect={true}
        // ── General config ──
        connectionRadius={20}
        connectionLineStyle={{ stroke: 'var(--color-accent)', strokeWidth: 2 }}
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
            const def = getNodeDefinition(nodeType)
            return def?.color || '#999'
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
        initialSubmenu={contextMenuInitialSubmenu}
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
