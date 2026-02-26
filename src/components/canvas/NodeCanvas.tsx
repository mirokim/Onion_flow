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
  type OnConnectStart,
} from '@xyflow/react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useProjectStore } from '@/stores/projectStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useEditorStore } from '@/stores/editorStore'
import { BaseNode } from '@nodes/_base/BaseNode'
import { GroupNode } from '@nodes/group/GroupNode'
import { CanvasToolbar } from './CanvasToolbar'
import { CanvasContextMenu } from './CanvasContextMenu'
import { getNodeDefinition, type NodeTypeDefinition, type HandleDataType, HANDLE_DATA_TYPE_COLORS } from '@nodes/index'
import { isTypeCompatible } from '@/utils/handleCompatibility'
import { toast } from '@/components/common/Toast'
import {
  addNodeWithUndo,
  removeNodeWithUndo,
  connectNodesWithUndo,
  disconnectWireWithUndo,
  updateNodePositionsBatchWithUndo,
  reconnectWireWithUndo,
} from '@/stores/undoCanvasActions'

const nodeTypes = {
  baseNode: BaseNode,
  groupNode: GroupNode,
}

function NodeCanvasInner() {
  const currentProject = useProjectStore(s => s.currentProject)

  const updateNodePosition = useCanvasStore(s => s.updateNodePosition)
  const updateNodeSize = useCanvasStore(s => s.updateNodeSize)
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
              zIndex: -1, // Groups always behind regular nodes
            }
          // plot_context nodes: pass stored dimensions only in write mode (resize support)
          : n.type === 'plot_context' && n.data?.mode === 'write' && n.width && n.height
          ? {
              width: n.width,
              height: n.height,
              style: { width: n.width, height: n.height },
            }
          : {}
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
    canvasWires.map(w => {
      // Derive wire color from source handle's dataType
      const srcNode = canvasNodes.find(n => n.id === w.sourceNodeId)
      const srcDef = srcNode ? getNodeDefinition(srcNode.type) : undefined
      const srcHandle = srcDef?.outputs.find(h => h.id === w.sourceHandle)
      const wireColor = srcHandle?.dataType
        ? (HANDLE_DATA_TYPE_COLORS[srcHandle.dataType] ?? HANDLE_DATA_TYPE_COLORS['*'])
        : HANDLE_DATA_TYPE_COLORS['*']

      return {
        id: w.id,
        source: w.sourceNodeId,
        target: w.targetNodeId,
        sourceHandle: w.sourceHandle,
        targetHandle: w.targetHandle,
        animated: true,
        style: { stroke: wireColor, strokeWidth: 2 },
      }
    }),
    [canvasWires, canvasNodes],
  )

  // ── Controlled component: local selection state, Zustand = single source of truth ──
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<Set<string>>(new Set())

  // Track measured dimensions locally (not in Zustand to avoid infinite re-measure loop).
  // MiniMap needs `measured` on user nodes to render them via nodeHasDimensions().
  const measuredDimsRef = useRef<Map<string, { width: number; height: number }>>(new Map())
  const [measureGeneration, setMeasureGeneration] = useState(0)

  // Merge selection + measured dimensions into rfNodes for ReactFlow
  const rfNodesWithSelection: Node[] = useMemo(
    () => rfNodes.map(n => {
      const m = measuredDimsRef.current.get(n.id)
      return { ...n, selected: selectedNodeIds.has(n.id), ...(m ? { measured: m } : {}) }
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rfNodes, selectedNodeIds, measureGeneration],
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
        // Instead, store measured dims locally so MiniMap can render nodes.
        const prev = measuredDimsRef.current.get(change.id)
        if (!prev || prev.width !== change.dimensions.width || prev.height !== change.dimensions.height) {
          measuredDimsRef.current.set(change.id, {
            width: change.dimensions.width,
            height: change.dimensions.height,
          })
          // Trigger re-render only when dimensions actually change (batched by React)
          setMeasureGeneration(g => g + 1)
        }

        // We only persist dimensions when a resize operation *actually ends*
        // (not on initial measurement, which would trigger a feedback loop).
        if ((change as any).resizing) {
          // User is actively resizing → track which node + update in-memory for real-time feedback
          resizingNodeRef.current = change.id
          useCanvasStore.setState(s => ({
            nodes: s.nodes.map(n =>
              n.id === change.id
                ? { ...n, width: change.dimensions!.width, height: change.dimensions!.height }
                : n,
            ),
          }))
        } else if (resizingNodeRef.current === change.id) {
          // Resize just ended → persist final dimensions to DB
          resizingNodeRef.current = null
          updateNodeSize(change.id, change.dimensions.width, change.dimensions.height)
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
  // Track which edge is currently being reconnected (to exclude it from duplicate checks)
  const reconnectingEdgeRef = useRef<string | null>(null)

  // ── Wire-drop node picker: track pending connection ──
  const pendingConnectionRef = useRef<{
    nodeId: string | null
    handleId: string | null
    handleType: string | null
  } | null>(null)
  const connectionMadeRef = useRef(false)
  const [pendingConnection, setPendingConnection] = useState<{
    nodeId: string
    handleId: string
    handleType: 'source' | 'target'
  } | null>(null)

  // ── Group resize tracking (avoid dimension feedback loop on initial measurement) ──
  const resizingNodeRef = useRef<string | null>(null)

  // ── Drag start positions for undo (captured in onNodeDragStart) ──
  const dragStartPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())

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
    disconnectWireWithUndo(edge.id)
  }, [])

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
    setPendingConnection(null)
  }, [])

  // ── Handlers ──

  const handleAddNodeAtPosition = useCallback(
    async (def: NodeTypeDefinition, position: { x: number; y: number }) => {
      if (!currentProject) {
        toast.warning('프로젝트를 먼저 생성하거나 선택하세요.')
        return
      }
      const isGroup = def.type === 'group'
      const newNode = await addNodeWithUndo(
        currentProject.id,
        def.type,
        position,
        def.defaultData,
        isGroup ? { width: 300, height: 200 } : undefined,
      )

      // Auto-connect if there's a pending wire drop
      if (pendingConnection && !isGroup) {
        const { nodeId, handleId, handleType } = pendingConnection

        if (handleType === 'source') {
          // Dragged FROM a source handle → connect source_node → new_node's first input
          const targetHandle = def.inputs.length > 0 ? def.inputs[0].id : 'in'
          connectNodesWithUndo(currentProject.id, nodeId, newNode.id, handleId, targetHandle)
        } else {
          // Dragged FROM a target handle → connect new_node's first output → source_node
          const sourceHandle = def.outputs.length > 0 ? def.outputs[0].id : 'out'
          connectNodesWithUndo(currentProject.id, newNode.id, nodeId, sourceHandle, handleId)
        }
        setPendingConnection(null)
      }
    },
    [currentProject, pendingConnection],
  )

  const handleAddGroup = useCallback(
    async (position: { x: number; y: number }) => {
      if (!currentProject) {
        toast.warning('프로젝트를 먼저 생성하거나 선택하세요.')
        return
      }
      await addNodeWithUndo(
        currentProject.id,
        'group',
        position,
        { label: 'Group' },
        { width: 300, height: 200 },
      )
    },
    [currentProject],
  )

  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      await removeNodeWithUndo(nodeId)
    },
    [],
  )

  // ── Wire-drop node picker: onConnectStart / onConnectEnd ──
  const onConnectStart: OnConnectStart = useCallback((_event, params) => {
    pendingConnectionRef.current = {
      nodeId: params.nodeId,
      handleId: params.handleId,
      handleType: params.handleType,
    }
    connectionMadeRef.current = false
  }, [])

  const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    if (connectionMadeRef.current) {
      pendingConnectionRef.current = null
      return
    }

    const params = pendingConnectionRef.current
    pendingConnectionRef.current = null
    if (!params?.nodeId || !params?.handleId || !params?.handleType) return

    // Get drop position
    let clientX: number, clientY: number
    if ('clientX' in event) {
      clientX = event.clientX
      clientY = event.clientY
    } else {
      const touch = event.changedTouches?.[0]
      if (!touch) return
      clientX = touch.clientX
      clientY = touch.clientY
    }

    const flowPos = screenToFlowPosition({ x: clientX, y: clientY })

    // Store pending connection for auto-connect when node is created
    setPendingConnection({
      nodeId: params.nodeId,
      handleId: params.handleId,
      handleType: params.handleType as 'source' | 'target',
    })

    // Show add-node menu at drop position
    setContextMenuInitialSubmenu('add-node')
    setContextTargetNodeId(null)
    setContextMenu({
      x: clientX,
      y: clientY,
      canvasX: flowPos.x,
      canvasY: flowPos.y,
    })
  }, [screenToFlowPosition])

  const isValidConnection = useCallback((connection: Edge | Connection) => {
    if (!connection.source || !connection.target) return false
    if (connection.source === connection.target) return false

    // Check for duplicate wires — one wire per node pair (any handle combination)
    // During edge reconnection, exclude the edge being moved so re-routing to a different
    // handle on the same target node is still allowed.
    const exists = storeWires.some(w =>
      w.id !== reconnectingEdgeRef.current &&
      w.sourceNodeId === connection.source &&
      w.targetNodeId === connection.target
    )
    if (exists) return false

    // ── Handle data type compatibility check ──
    const srcNode = canvasNodes.find(n => n.id === connection.source)
    const tgtNode = canvasNodes.find(n => n.id === connection.target)
    if (srcNode && tgtNode) {
      const srcDef = getNodeDefinition(srcNode.type)
      const tgtDef = getNodeDefinition(tgtNode.type)
      if (srcDef && tgtDef) {
        const srcHandle = srcDef.outputs.find(h => h.id === connection.sourceHandle)
        const tgtHandle = tgtDef.inputs.find(h => h.id === connection.targetHandle)
        if (srcHandle && tgtHandle) {
          const srcType: HandleDataType = srcHandle.dataType ?? '*'
          const accepts: HandleDataType[] = tgtHandle.acceptsTypes ?? ['*']
          if (!isTypeCompatible(srcType, accepts)) return false
        }
      }
    }

    return true
  }, [storeWires, canvasNodes])

  const onConnect = useCallback(
    (connection: Connection) => {
      connectionMadeRef.current = true
      if (!currentProject || !connection.source || !connection.target) return
      connectNodesWithUndo(
        currentProject.id,
        connection.source,
        connection.target,
        connection.sourceHandle || 'out',
        connection.targetHandle || 'in',
      )
    },
    [currentProject],
  )

  const onNodeDragStart = useCallback(
    (_event: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      dragStartPositionsRef.current.clear()
      for (const dn of draggedNodes) {
        dragStartPositionsRef.current.set(dn.id, { ...dn.position })
      }
    },
    [],
  )

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node, draggedNodes: Node[]) => {
      // Build moves array with old/new positions for undo
      const moves = draggedNodes.map(dn => ({
        nodeId: dn.id,
        oldPosition: dragStartPositionsRef.current.get(dn.id) || { ...dn.position },
        newPosition: { ...dn.position },
      }))
      dragStartPositionsRef.current.clear()

      // Persist positions with undo support
      updateNodePositionsBatchWithUndo(moves)

      // Auto-detect group membership: if a non-group node is dropped inside a group, add it
      const groups = canvasNodes.filter(n => n.type === 'group')
      if (groups.length === 0) return

      for (const dn of draggedNodes) {
        if (dn.type === 'groupNode') continue
        const nodeData = dn.data as Record<string, any>
        if (nodeData?.groupId) continue // Already in a group

        for (const group of groups) {
          const gw = group.width || 300
          const gh = group.height || 200
          if (
            dn.position.x >= group.position.x &&
            dn.position.x <= group.position.x + gw &&
            dn.position.y >= group.position.y &&
            dn.position.y <= group.position.y + gh
          ) {
            addNodeToGroup(dn.id, group.id)
            break
          }
        }
      }
    },
    [canvasNodes, addNodeToGroup],
  )

  // Node double-click → open linked wiki entry (or create one for plot nodes)
  const onNodeDoubleClick = useCallback(
    async (_event: React.MouseEvent, node: Node) => {
      const nodeData = node.data as Record<string, any>
      const nodeType = nodeData?.nodeType as string | undefined

      // Helper: ensure wiki panel is open and select entry
      const openWikiEntry = (entryId: string) => {
        const editorState = useEditorStore.getState()
        if (!editorState.openTabs.includes('wiki')) {
          editorState.toggleTab('wiki')
        }
        useWikiStore.getState().selectEntry(entryId)
      }

      // If node already has a wikiEntryId, navigate to it
      if (nodeData?.wikiEntryId) {
        openWikiEntry(nodeData.wikiEntryId as string)
        return
      }

      // Plot nodes without wikiEntryId: create a new "story" wiki entry
      if (nodeType?.startsWith('plot_') && currentProject) {
        const entry = await useWikiStore.getState().createEntry(
          currentProject.id,
          'story',
          '',
        )
        // Link the new entry to this node
        if (nodeData?.nodeId) {
          useCanvasStore.getState().updateNodeData(nodeData.nodeId as string, {
            wikiEntryId: entry.id,
          })
        }
        openWikiEntry(entry.id)
      }
    },
    [currentProject],
  )

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      for (const node of deleted) {
        removeNodeWithUndo(node.id)
      }
    },
    [],
  )

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      for (const edge of deleted) {
        disconnectWireWithUndo(edge.id)
      }
    },
    [],
  )

  // ── Edge reconnection: drag handle to reconnect or drop on empty space to disconnect ──
  const handleReconnectStart = useCallback((_event: React.MouseEvent, edge: Edge) => {
    reconnectSuccessful.current = false
    reconnectingEdgeRef.current = edge.id
  }, [])

  const handleReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      reconnectSuccessful.current = true
      if (!currentProject || !newConnection.source || !newConnection.target) return
      // Reconnect with undo (compound: delete old + create new)
      reconnectWireWithUndo(
        currentProject.id,
        oldEdge.id,
        newConnection.source,
        newConnection.target,
        newConnection.sourceHandle || 'out',
        newConnection.targetHandle || 'in',
      )
    },
    [currentProject],
  )

  const handleReconnectEnd = useCallback(
    (_event: MouseEvent | TouchEvent, edge: Edge) => {
      // If edge was dropped on empty space (not reconnected), disconnect it
      if (!reconnectSuccessful.current) {
        disconnectWireWithUndo(edge.id)
      }
      reconnectingEdgeRef.current = null
    },
    [],
  )

  const handleAddNode = useCallback(
    (def: NodeTypeDefinition) => {
      if (!currentProject) {
        toast.warning('프로젝트를 먼저 생성하거나 선택하세요.')
        return
      }
      const position = { x: 200 + Math.random() * 200, y: 100 + Math.random() * 200 }
      const isGroup = def.type === 'group'
      addNodeWithUndo(
        currentProject.id,
        def.type,
        position,
        def.defaultData,
        isGroup ? { width: 300, height: 200 } : undefined,
      )
    },
    [currentProject],
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
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStart={onNodeDragStart}
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
        proOptions={{ hideAttribution: true }}
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
