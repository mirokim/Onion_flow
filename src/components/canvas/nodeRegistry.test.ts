/**
 * Unit tests for nodeRegistry.
 * Tests: registry completeness, lookup functions, category filtering.
 */
import { describe, it, expect } from 'vitest'
import {
  NODE_REGISTRY,
  NODE_CATEGORY_COLORS,
  getNodeDefinition,
  getNodesByCategory,
} from '@nodes/index'
import type { CanvasNodeCategory } from '@/types'

describe('nodeRegistry', () => {
  describe('NODE_REGISTRY', () => {
    it('should contain all expected node types', () => {
      const types = NODE_REGISTRY.map(n => n.type)

      // Context
      expect(types).toContain('character')
      expect(types).toContain('event')
      expect(types).toContain('wiki')
      expect(types).toContain('personality')
      expect(types).toContain('appearance')
      expect(types).toContain('memory')

      // Direction
      expect(types).toContain('pov')
      expect(types).toContain('pacing')
      expect(types).toContain('style_transfer')

      // Processing
      expect(types).toContain('storyteller')
      expect(types).toContain('summarizer')

      // Special
      expect(types).toContain('what_if')
      expect(types).toContain('show_dont_tell')
      expect(types).toContain('tikitaka')
      expect(types).toContain('cliffhanger')
      expect(types).toContain('virtual_reader')

      // Detector
      expect(types).toContain('emotion_tracker')
      expect(types).toContain('foreshadow_detector')
      expect(types).toContain('conflict_defense')

      // Output
      expect(types).toContain('save_story')

      // Structure
      expect(types).toContain('group')
    })

    it('should have no duplicate types', () => {
      const types = NODE_REGISTRY.map(n => n.type)
      const unique = new Set(types)
      expect(types.length).toBe(unique.size)
    })

    it('every node should have label, labelKo, category, and color', () => {
      for (const def of NODE_REGISTRY) {
        expect(def.label).toBeTruthy()
        expect(def.labelKo).toBeTruthy()
        expect(def.category).toBeTruthy()
        expect(def.color).toBeTruthy()
      }
    })

    it('every node should have defaultData', () => {
      for (const def of NODE_REGISTRY) {
        expect(def.defaultData).toBeDefined()
        expect(typeof def.defaultData).toBe('object')
      }
    })

    it('every node should have inputs and outputs arrays', () => {
      for (const def of NODE_REGISTRY) {
        expect(Array.isArray(def.inputs)).toBe(true)
        expect(Array.isArray(def.outputs)).toBe(true)
      }
    })

    it('handles should have id, label, type, and position', () => {
      for (const def of NODE_REGISTRY) {
        for (const handle of [...def.inputs, ...def.outputs]) {
          expect(handle.id).toBeTruthy()
          expect(handle.label).toBeTruthy()
          expect(['source', 'target']).toContain(handle.type)
          expect(['left', 'right', 'top', 'bottom']).toContain(handle.position)
        }
      }
    })

    it('context source nodes should only have output handles (data sources)', () => {
      // Character has input handles (personality, appearance, memory), so we check other context nodes
      const sourceNodes = NODE_REGISTRY.filter(n =>
        n.category === 'context' && n.type !== 'character',
      )
      for (const def of sourceNodes) {
        expect(def.inputs).toHaveLength(0)
        expect(def.outputs.length).toBeGreaterThan(0)
      }
    })

    it('character node should have 3 input handles for sub-nodes', () => {
      const character = NODE_REGISTRY.find(n => n.type === 'character')!
      expect(character.inputs).toHaveLength(3)
      const inputIds = character.inputs.map(i => i.id)
      expect(inputIds).toContain('personality')
      expect(inputIds).toContain('appearance')
      expect(inputIds).toContain('memory')
    })

    it('save_story node should have 1 input and no outputs', () => {
      const saveStory = NODE_REGISTRY.find(n => n.type === 'save_story')!
      expect(saveStory.inputs).toHaveLength(1)
      expect(saveStory.inputs[0].id).toBe('story')
      expect(saveStory.outputs).toHaveLength(0)
      expect(saveStory.category).toBe('output')
    })

    it('storyteller node should have multiple input handles', () => {
      const storyteller = NODE_REGISTRY.find(n => n.type === 'storyteller')!
      expect(storyteller.inputs.length).toBeGreaterThanOrEqual(2)
      expect(storyteller.inputs.map(i => i.id)).toContain('context')
      expect(storyteller.inputs.map(i => i.id)).toContain('direction')
    })

    it('group node should have no handles', () => {
      const group = NODE_REGISTRY.find(n => n.type === 'group')!
      expect(group.inputs).toHaveLength(0)
      expect(group.outputs).toHaveLength(0)
      expect(group.category).toBe('structure')
    })
  })

  describe('NODE_CATEGORY_COLORS', () => {
    it('should define colors for all categories', () => {
      const categories: CanvasNodeCategory[] = [
        'context', 'direction', 'processing', 'special', 'detector', 'structure', 'output',
      ]
      for (const cat of categories) {
        expect(NODE_CATEGORY_COLORS[cat]).toBeTruthy()
        expect(NODE_CATEGORY_COLORS[cat]).toMatch(/^#[0-9a-fA-F]{6}$/)
      }
    })
  })

  describe('getNodeDefinition', () => {
    it('should return the correct definition for a known type', () => {
      const def = getNodeDefinition('character')
      expect(def).toBeDefined()
      expect(def!.type).toBe('character')
      expect(def!.labelKo).toBe('캐릭터')
    })

    it('should return undefined for an unknown type', () => {
      const def = getNodeDefinition('nonexistent' as any)
      expect(def).toBeUndefined()
    })

    it('should return the group node definition', () => {
      const def = getNodeDefinition('group')
      expect(def).toBeDefined()
      expect(def!.category).toBe('structure')
    })
  })

  describe('getNodesByCategory', () => {
    it('should return only nodes of the specified category', () => {
      const contextNodes = getNodesByCategory('context')
      expect(contextNodes.length).toBeGreaterThan(0)
      for (const def of contextNodes) {
        expect(def.category).toBe('context')
      }
    })

    it('should return 6 context nodes', () => {
      expect(getNodesByCategory('context')).toHaveLength(6)
    })

    it('should return 3 direction nodes', () => {
      expect(getNodesByCategory('direction')).toHaveLength(3)
    })

    it('should return 2 processing nodes', () => {
      expect(getNodesByCategory('processing')).toHaveLength(2)
    })

    it('should return 5 special nodes', () => {
      expect(getNodesByCategory('special')).toHaveLength(5)
    })

    it('should return 3 detector nodes', () => {
      expect(getNodesByCategory('detector')).toHaveLength(3)
    })

    it('should return 1 structure node (group)', () => {
      expect(getNodesByCategory('structure')).toHaveLength(1)
    })

    it('should return 1 output node (save_story)', () => {
      expect(getNodesByCategory('output')).toHaveLength(1)
    })

    it('should return empty array for unknown category', () => {
      expect(getNodesByCategory('unknown' as any)).toHaveLength(0)
    })
  })
})
