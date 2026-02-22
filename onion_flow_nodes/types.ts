/**
 * Node plugin type definitions.
 * Shared by built-in and custom (user-added) nodes.
 */
import type { CanvasNodeCategory } from '@/types'

export interface HandleDefinition {
  id: string
  label: string
  type: 'source' | 'target'
  position: 'left' | 'right' | 'top' | 'bottom'
}

export interface NodeTypeDefinition {
  type: string                   // e.g. 'character', 'my_custom_node'
  label: string                  // English display name
  labelKo: string                // Korean display name
  category: CanvasNodeCategory
  color: string                  // Hex color, e.g. '#4a90d9'
  inputs: HandleDefinition[]
  outputs: HandleDefinition[]
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
}
