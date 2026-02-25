/**
 * Node Plugin API — Onion Flow Plugin Architecture
 *
 * Each NodePlugin bundles a node's definition, UI component,
 * and behavior logic in a single, self-contained module.
 * Adding a new node only requires creating ONE file.
 */
import type { NodeTypeDefinition } from './types'
import type { CanvasNode, WikiEntry } from '@/types'
import type React from 'react'

/**
 * Props passed to every node body component.
 */
export interface NodeBodyProps {
  nodeId: string
  data: Record<string, any>
  selected: boolean
}

/**
 * A single segment of the AI system prompt.
 * Segments are sorted by priority (higher = earlier in prompt).
 */
export interface PromptSegment {
  role: string
  content: string
  priority: number
}

/**
 * A NodePlugin is the single source of truth for one node type.
 * It bundles: definition, UI component, data extraction, prompt building, and execution.
 */
export interface NodePlugin {
  /** Node type definition (handles, color, label, category, defaultData) */
  definition: NodeTypeDefinition

  /**
   * Body UI component rendered inside the node card.
   * If undefined, the node renders nothing below the header (label only).
   */
  bodyComponent?: React.ComponentType<NodeBodyProps>

  /**
   * For ExecutionEngine: extract this node's data as a plain text string.
   * Used by context/direction nodes during upstream traversal.
   * Replaces switch cases in extractNodeDataText().
   */
  extractData?: (node: CanvasNode, wikiEntries: WikiEntry[]) => string | null

  /**
   * For StorytellerEngine: build a structured prompt segment from this node's data.
   * Replaces switch cases in processNode().
   */
  buildPromptSegment?: (node: CanvasNode, wikiEntries: WikiEntry[]) => PromptSegment | null

  /**
   * For ExecutionEngine: run this node (AI call or transformation).
   * @param node The node to execute
   * @param collectContext Utility to gather upstream context text for a node ID
   * Replaces switch cases in executeNode().
   */
  execute?: (node: CanvasNode, collectContext: (nodeId: string) => string) => Promise<string>

  /**
   * If true, this node is included in the execution queue (EXECUTABLE_TYPES).
   */
  isExecutable?: boolean

  /**
   * For switch-like nodes: return the set of allowed input handle IDs.
   * Returns null to allow all inputs (default behavior).
   * Replaces switch cases in getAllowedInputHandles().
   */
  getAllowedInputHandles?: (node: CanvasNode) => Set<string> | null
}

// ── Registry ──────────────────────────────────────────────────────────────────

const PLUGIN_REGISTRY = new Map<string, NodePlugin>()

export function registerPlugin(plugin: NodePlugin): void {
  PLUGIN_REGISTRY.set(plugin.definition.type, plugin)
}

export function getPlugin(type: string): NodePlugin | undefined {
  return PLUGIN_REGISTRY.get(type)
}

export function getAllPlugins(): NodePlugin[] {
  return [...PLUGIN_REGISTRY.values()]
}
