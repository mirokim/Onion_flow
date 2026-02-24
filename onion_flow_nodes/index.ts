/**
 * Node Registry — central module for all node definitions.
 *
 * Built-in nodes are statically imported from builtins.ts.
 * Custom nodes are dynamically loaded from onion_flow_nodes/ folder at startup.
 *
 * Usage:
 *   import { NODE_REGISTRY, initNodeRegistry, getNodeDefinition } from '@/onion_flow_nodes'
 */
export { type NodeTypeDefinition, type HandleDefinition, NODE_CATEGORY_COLORS, NODE_TAG_LABELS } from './types'
export { PLOT_GENRE_OPTIONS, PLOT_STRUCTURE_OPTIONS, GENRE_GROUPS, type PlotOption } from './plotOptions'
import { BUILTIN_NODES } from './builtins'
import { loadCustomNodes } from './loader'
import type { NodeTypeDefinition } from './types'
import type { CanvasNodeCategory } from '@/types'

/**
 * The global node registry array. Mutated in-place by initNodeRegistry().
 * Starts with built-in nodes only; custom nodes are merged at startup.
 */
export const NODE_REGISTRY: NodeTypeDefinition[] = [...BUILTIN_NODES]

/**
 * Initialize the node registry by scanning for custom nodes.
 * Should be called once during app startup, after DB init but before project load.
 */
export async function initNodeRegistry(): Promise<void> {
  const customs = await loadCustomNodes()

  // Reset and rebuild registry: builtins first, then merge customs
  NODE_REGISTRY.length = 0
  NODE_REGISTRY.push(...BUILTIN_NODES)

  for (const c of customs) {
    const idx = NODE_REGISTRY.findIndex(n => n.type === c.type)
    if (idx >= 0) {
      // Custom node overrides built-in of same type
      NODE_REGISTRY[idx] = c
    } else {
      NODE_REGISTRY.push(c)
    }
  }

  console.log(
    `[NodeRegistry] Loaded ${BUILTIN_NODES.length} built-in + ${customs.length} custom nodes (${NODE_REGISTRY.length} total)`,
  )
}

/**
 * Look up a single node definition by type string.
 */
export function getNodeDefinition(type: string): NodeTypeDefinition | undefined {
  return NODE_REGISTRY.find(n => n.type === type)
}

/**
 * Get all nodes of a given category.
 */
export function getNodesByCategory(category: CanvasNodeCategory): NodeTypeDefinition[] {
  return NODE_REGISTRY.filter(n => n.category === category)
}
