/**
 * Node Registry — central module for all node definitions.
 *
 * Built-in nodes are registered via builtins.ts (side-effect imports).
 * Custom nodes are dynamically loaded from the filesystem at startup.
 *
 * Usage:
 *   import { NODE_REGISTRY, initNodeRegistry, getNodeDefinition } from '@nodes/index'
 */
export { type NodeTypeDefinition, type HandleDefinition, type HandleDataType, NODE_CATEGORY_COLORS, NODE_TAG_LABELS, HANDLE_DATA_TYPE_COLORS } from './types'
export { PLOT_GENRE_OPTIONS, PLOT_STRUCTURE_OPTIONS, GENRE_GROUPS, type PlotOption, OUTPUT_FORMAT_OPTIONS, OUTPUT_FORMAT_GROUPS, type OutputFormatOption } from './plotOptions'
export { type NodePlugin, type NodeBodyProps, type PromptSegment, registerPlugin, getPlugin, getAllPlugins } from './plugin'

// Trigger side-effect registration of all built-in plugins
import './builtins'

import { loadCustomNodes } from './loader'
import { getAllPlugins } from './plugin'
import type { NodeTypeDefinition } from './types'
import type { CanvasNodeCategory } from '@/types'

/**
 * The global node registry array. Derived from the plugin registry.
 * Pre-populated at module load with all built-in plugins.
 * initNodeRegistry() merges in custom nodes (loaded from filesystem).
 */
export const NODE_REGISTRY: NodeTypeDefinition[] = getAllPlugins().map(p => p.definition)

/**
 * Initialize the node registry by scanning for custom nodes.
 * Should be called once during app startup, after DB init but before project load.
 */
export async function initNodeRegistry(): Promise<void> {
  const customs = await loadCustomNodes()

  // Rebuild: start from plugin registry (built-ins), then merge custom nodes
  NODE_REGISTRY.length = 0
  NODE_REGISTRY.push(...getAllPlugins().map(p => p.definition))

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
    `[NodeRegistry] Loaded ${getAllPlugins().length} built-in + ${customs.length} custom nodes (${NODE_REGISTRY.length} total)`,
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

/**
 * Derive the set of executable node types from the plugin registry.
 * Used by executionEngine to know which nodes to run.
 */
export function getExecutableTypes(): Set<string> {
  return new Set(getAllPlugins().filter(p => p.isExecutable).map(p => p.definition.type))
}
