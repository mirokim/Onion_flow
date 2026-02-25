/**
 * Execution Engine — ComfyUI-style canvas execution.
 *
 * Flow:
 * 1. Collect all nodes at current depth
 * 2. Build dependency graph from wires
 * 3. Topological sort (Kahn's algorithm)
 * 4. Execute each executable node in order
 * 5. Report status via callback
 *
 * Non-executable nodes (context, direction, structure) are skipped.
 * Their data is collected by upstream traversal when executable nodes run.
 */
import { useCanvasStore, type NodeOutput } from '@/stores/canvasStore'
import { useWikiStore } from '@/stores/wikiStore'
import { getPlugin, getExecutableTypes } from '@nodes/index'
import type { CanvasNode, CanvasWire } from '@/types'

/** Node types that can be executed (have AI processing) — derived from plugin registry */
const EXECUTABLE_TYPES = getExecutableTypes()

/**
 * Topological sort using Kahn's algorithm.
 * Returns nodes in execution order (upstream first).
 */
function topologicalSort(nodes: CanvasNode[], wires: CanvasWire[]): CanvasNode[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()

  // Initialize
  for (const n of nodes) {
    inDegree.set(n.id, 0)
    adjacency.set(n.id, [])
  }

  // Build adjacency from wires
  for (const w of wires) {
    if (!nodeMap.has(w.sourceNodeId) || !nodeMap.has(w.targetNodeId)) continue
    adjacency.get(w.sourceNodeId)!.push(w.targetNodeId)
    inDegree.set(w.targetNodeId, (inDegree.get(w.targetNodeId) || 0) + 1)
  }

  // Kahn's algorithm
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: CanvasNode[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (node) sorted.push(node)

    for (const neighbor of adjacency.get(id) || []) {
      const newDeg = (inDegree.get(neighbor) || 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  return sorted
}

/**
 * Get the set of allowed input handle IDs for a node.
 * Delegates to the node's plugin getAllowedInputHandles method.
 * Returns null = all inputs allowed (default).
 */
function getAllowedInputHandles(node: CanvasNode): Set<string> | null {
  return getPlugin(node.type)?.getAllowedInputHandles?.(node) ?? null
}

/**
 * Collect upstream context text for a given node.
 */
function collectUpstreamContext(nodeId: string): string {
  const { nodes, wires, nodeOutputs } = useCanvasStore.getState()
  const visited = new Set<string>()
  const parts: string[] = []

  const traverse = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)

    const currentNode = nodes.find(n => n.id === id)
    const allowedHandles = currentNode ? getAllowedInputHandles(currentNode) : null

    const incoming = wires.filter(w => {
      if (w.targetNodeId !== id) return false
      if (allowedHandles && w.targetHandle && !allowedHandles.has(w.targetHandle)) return false
      return true
    })

    for (const wire of incoming) {
      const sourceNode = nodes.find(n => n.id === wire.sourceNodeId)
      if (!sourceNode) continue

      // If the upstream node has already been executed, use its output
      const output = nodeOutputs[sourceNode.id]
      if (output?.status === 'completed' && output.content) {
        parts.push(output.content)
      } else {
        // For context/direction nodes, extract their data via plugin
        const nodeData = extractNodeDataText(sourceNode)
        if (nodeData) parts.push(nodeData)
      }

      traverse(sourceNode.id)
    }
  }

  traverse(nodeId)
  return parts.join('\n\n')
}

/**
 * Extract displayable text from a context/direction node's data.
 * Delegates to the node's plugin extractData method.
 */
function extractNodeDataText(node: CanvasNode): string | null {
  const wikiEntries = useWikiStore.getState().entries
  return getPlugin(node.type)?.extractData?.(node, wikiEntries) ?? null
}

/**
 * Execute a single node based on its type.
 * Delegates to the node's plugin execute method.
 */
async function executeNode(node: CanvasNode): Promise<string> {
  const plugin = getPlugin(node.type)
  if (!plugin?.execute) {
    return `노드 타입 "${node.type}"은(는) 실행할 수 없습니다.`
  }
  return plugin.execute(node, collectUpstreamContext)
}

/**
 * Execute the entire canvas graph.
 * Follows topological order, executing only EXECUTABLE_TYPES nodes.
 */
export async function executeCanvas(
  callback: (nodeId: string, output: NodeOutput) => void,
): Promise<void> {
  const { nodes, wires } = useCanvasStore.getState()
  const parentId = useCanvasStore.getState().getCurrentParentCanvasId()

  // Filter to current depth
  const depthNodes = nodes.filter(n => n.parentCanvasId === parentId)
  const depthWires = wires.filter(w => w.parentCanvasId === parentId)

  // Topological sort
  const sorted = topologicalSort(depthNodes, depthWires)

  // Filter to executable nodes only
  const executableNodes = sorted.filter(n => EXECUTABLE_TYPES.has(n.type))

  // Mark all executable nodes as queued
  for (const node of executableNodes) {
    callback(node.id, { status: 'queued', content: '' })
  }

  // Execute in order
  for (const node of executableNodes) {
    callback(node.id, { status: 'running', content: '' })

    try {
      const result = await executeNode(node)
      callback(node.id, { status: 'completed', content: result })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      callback(node.id, { status: 'error', content: '', error: errorMsg })
    }
  }
}
