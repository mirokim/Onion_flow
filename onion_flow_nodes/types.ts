/**
 * Node Plugin Type Definitions — Onion Flow Node SDK
 *
 * This is the public API for creating Onion Flow node plugins.
 * Both built-in and custom (user-added) nodes use this format.
 *
 * ## Plugin Structure
 *
 * A plugin lives in a folder under `onion_flow_nodes/`:
 *
 * ```
 * onion_flow_nodes/
 *   my_plugin/
 *     definition.json   ← NodeTypeDefinition (required)
 *     README.md          ← Description (optional)
 * ```
 *
 * ## definition.json Schema
 *
 * ```json
 * {
 *   "type": "my_custom_node",
 *   "label": "My Custom Node",
 *   "labelKo": "커스텀 노드",
 *   "category": "processing",
 *   "tags": ["custom", "ai"],
 *   "color": "#67c23a",
 *   "description": "A custom node that does X",
 *   "descriptionKo": "X를 수행하는 커스텀 노드",
 *   "author": "username",
 *   "version": "1.0.0",
 *   "inputs": [
 *     { "id": "in", "label": "Input", "type": "target", "position": "left" }
 *   ],
 *   "outputs": [
 *     { "id": "out", "label": "Output", "type": "source", "position": "right" }
 *   ],
 *   "defaultData": {}
 * }
 * ```
 */
import type { CanvasNodeCategory } from '@/types'

/**
 * Semantic data type carried by a handle connection.
 * '*' is wildcard — compatible with every other type.
 */
export type HandleDataType =
  | 'CONTEXT'    // memory, motivation, event, wiki, image_load, document_load
  | 'CHARACTER'  // character node output
  | 'PLOT'       // plot_genre, plot_structure, plot_context
  | 'DIRECTION'  // pov, pacing, style_transfer, output_format
  | 'TEXT'       // AI text output (storyteller, summarizer, etc.)
  | '*'          // wildcard — accepts / emits any type

/** Color map for handle data types. Single source of truth. */
export const HANDLE_DATA_TYPE_COLORS: Record<HandleDataType, string> = {
  CONTEXT:   '#4a90d9',
  CHARACTER: '#22d3ee',
  PLOT:      '#e91e63',
  DIRECTION: '#e6a23c',
  TEXT:      '#67c23a',
  '*':       '#6b7280',
}

export interface HandleDefinition {
  id: string
  label: string
  type: 'source' | 'target'
  position: 'left' | 'right' | 'top' | 'bottom'
  /**
   * For source handles: the data type this handle emits.
   * Defaults to '*' if omitted (backward compatible).
   */
  dataType?: HandleDataType
  /**
   * For target handles: list of data types this handle accepts.
   * Defaults to ['*'] if omitted (backward compatible).
   */
  acceptsTypes?: HandleDataType[]
}

export interface NodeTypeDefinition {
  /** Unique node type identifier, e.g. 'character', 'my_custom_node' */
  type: string
  /** English display name */
  label: string
  /** Korean display name (falls back to `label` if omitted) */
  labelKo: string
  /** Node category for grouping */
  category: CanvasNodeCategory
  /** Tags for filtering/searching (e.g. ['ai', 'context', 'data']) */
  tags: string[]
  /** Hex color string, e.g. '#4a90d9' */
  color: string
  /** Short description (English) */
  description?: string
  /** Short description (Korean) */
  descriptionKo?: string
  /** Plugin author */
  author?: string
  /** Plugin version (semver) */
  version?: string
  /** Input handle definitions */
  inputs: HandleDefinition[]
  /** Output handle definitions */
  outputs: HandleDefinition[]
  /** Default node data when created */
  defaultData: Record<string, any>
}

export const NODE_CATEGORY_COLORS: Record<CanvasNodeCategory, string> = {
  context: '#4a90d9',
  direction: '#e6a23c',
  processing: '#67c23a',
  special: '#f56c6c',
  detector: '#909399',
  structure: '#8b5cf6',
  output: '#e040fb',
  plot: '#e91e63',
}

/** All built-in tags with Korean labels */
export const NODE_TAG_LABELS: Record<string, string> = {
  context: '컨텍스트',
  direction: '디렉션',
  processing: '프로세싱',
  special: '스페셜',
  detector: '디텍터',
  output: '출력',
  plot: '플롯 애드온',
  ai: 'AI',
  character: '캐릭터',
  wiki: '위키',
  data: '데이터',
  structure: '구조',
  custom: '커스텀',
}
