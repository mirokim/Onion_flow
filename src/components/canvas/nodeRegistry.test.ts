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
      expect(types).toContain('memory')
      expect(types).toContain('motivation')
      expect(types).toContain('image_load')
      expect(types).toContain('document_load')

      // Plot
      expect(types).toContain('plot_context')

      // Direction
      expect(types).toContain('pov')
      expect(types).toContain('pacing')
      expect(types).toContain('style_transfer')

      // Processing
      expect(types).toContain('storyteller')
      expect(types).toContain('summarizer')
      expect(types).toContain('switch')

      // Special
      expect(types).toContain('preview_changed')
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
      expect(types).toContain('save_content')
      expect(types).toContain('preview_content')

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

    it('character node should have 2 input handles (motivation_in, memory_in)', () => {
      const character = NODE_REGISTRY.find(n => n.type === 'character')!
      expect(character.inputs).toHaveLength(2)
      const inputIds = character.inputs.map(i => i.id)
      expect(inputIds).toContain('motivation_in')
      expect(inputIds).toContain('memory_in')
    })

    it('memory and motivation nodes should have plot_in input handle', () => {
      const memory = NODE_REGISTRY.find(n => n.type === 'memory')!
      expect(memory.inputs).toHaveLength(1)
      expect(memory.inputs[0].id).toBe('plot_in')

      const motivation = NODE_REGISTRY.find(n => n.type === 'motivation')!
      expect(motivation.inputs).toHaveLength(1)
      expect(motivation.inputs[0].id).toBe('plot_in')
    })

    it('save_content node should have 1 input and no outputs', () => {
      const saveContent = NODE_REGISTRY.find(n => n.type === 'save_content')!
      expect(saveContent.inputs).toHaveLength(1)
      expect(saveContent.inputs[0].id).toBe('content')
      expect(saveContent.outputs).toHaveLength(0)
      expect(saveContent.category).toBe('output')
    })

    it('preview_content node should have 1 input and no outputs', () => {
      const previewContent = NODE_REGISTRY.find(n => n.type === 'preview_content')!
      expect(previewContent.inputs).toHaveLength(1)
      expect(previewContent.inputs[0].id).toBe('content')
      expect(previewContent.outputs).toHaveLength(0)
      expect(previewContent.category).toBe('output')
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

    it('plot_context node should have wikiEntryId in defaultData and plot category', () => {
      const plot = NODE_REGISTRY.find(n => n.type === 'plot_context')!
      expect(plot.category).toBe('plot')
      expect(plot.defaultData).toHaveProperty('wikiEntryId')
    })

    it('plot_genre node should have selectedGenre in defaultData', () => {
      const plotGenre = NODE_REGISTRY.find(n => n.type === 'plot_genre')!
      expect(plotGenre.category).toBe('plot')
      expect(plotGenre.defaultData).toHaveProperty('selectedGenre')
    })

    it('plot_structure node should have selectedStructure in defaultData', () => {
      const plotStructure = NODE_REGISTRY.find(n => n.type === 'plot_structure')!
      expect(plotStructure.category).toBe('plot')
      expect(plotStructure.defaultData).toHaveProperty('selectedStructure')
    })

    it('preview_changed node should accept character input', () => {
      const previewChanged = NODE_REGISTRY.find(n => n.type === 'preview_changed')!
      expect(previewChanged.inputs).toHaveLength(1)
      expect(previewChanged.inputs[0].id).toBe('character_in')
      expect(previewChanged.category).toBe('special')
    })
  })

  describe('NODE_CATEGORY_COLORS', () => {
    it('should define colors for all categories', () => {
      const categories: CanvasNodeCategory[] = [
        'context', 'direction', 'processing', 'special', 'detector', 'structure', 'output', 'plot',
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

    it('should return 7 context nodes', () => {
      expect(getNodesByCategory('context')).toHaveLength(7)
    })

    it('should return 3 plot nodes (plot_genre, plot_structure, plot_context)', () => {
      const plots = getNodesByCategory('plot')
      expect(plots).toHaveLength(3)
      const types = plots.map(n => n.type)
      expect(types).toContain('plot_genre')
      expect(types).toContain('plot_structure')
      expect(types).toContain('plot_context')
    })

    it('should return 4 direction nodes (pov, pacing, style_transfer, output_format)', () => {
      const dirs = getNodesByCategory('direction')
      expect(dirs).toHaveLength(4)
      const types = dirs.map(n => n.type)
      expect(types).toContain('pov')
      expect(types).toContain('pacing')
      expect(types).toContain('style_transfer')
      expect(types).toContain('output_format')
    })

    it('should return 4 processing nodes (storyteller, summarizer, switch, smart_switch)', () => {
      const procs = getNodesByCategory('processing')
      expect(procs).toHaveLength(4)
      const types = procs.map(n => n.type)
      expect(types).toContain('storyteller')
      expect(types).toContain('summarizer')
      expect(types).toContain('switch')
      expect(types).toContain('smart_switch')
    })

    it('should return 6 special nodes', () => {
      expect(getNodesByCategory('special')).toHaveLength(6)
    })

    it('should return 3 detector nodes', () => {
      expect(getNodesByCategory('detector')).toHaveLength(3)
    })

    it('should return 1 structure node (group)', () => {
      expect(getNodesByCategory('structure')).toHaveLength(1)
    })

    it('should return 2 output nodes (save_content, preview_content)', () => {
      expect(getNodesByCategory('output')).toHaveLength(2)
    })

    it('should return empty array for unknown category', () => {
      expect(getNodesByCategory('unknown' as any)).toHaveLength(0)
    })
  })
})
