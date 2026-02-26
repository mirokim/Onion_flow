/**
 * Unit tests for AI tool definitions and format converters.
 * Pure function/data tests -- no mocks.
 */
import { describe, it, expect } from 'vitest'
import {
  AI_TOOLS,
  toOpenAITools,
  toOpenAIToolsCompact,
  toAnthropicTools,
  toGeminiTools,
} from '@/ai/tools'

// ── AI_TOOLS array shape ──

describe('AI_TOOLS', () => {
  it('has exactly 19 tool definitions', () => {
    expect(AI_TOOLS).toHaveLength(23)
  })

  it('every tool has a non-empty name string', () => {
    for (const tool of AI_TOOLS) {
      expect(typeof tool.name).toBe('string')
      expect(tool.name.length).toBeGreaterThan(0)
    }
  })

  it('every tool has a non-empty description string', () => {
    for (const tool of AI_TOOLS) {
      expect(typeof tool.description).toBe('string')
      expect(tool.description.length).toBeGreaterThan(0)
    }
  })

  it('every tool has parameters.type === "object"', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.parameters).toBeDefined()
      expect(tool.parameters.type).toBe('object')
    }
  })

  it('every tool has a properties object in parameters', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.parameters.properties).toBeDefined()
      expect(typeof tool.parameters.properties).toBe('object')
    }
  })

  it('all tool names are unique', () => {
    const names = AI_TOOLS.map(t => t.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it('contains all expected tool names', () => {
    const names = new Set(AI_TOOLS.map(t => t.name))
    const expected = [
      'save_outline',
      'update_character',
      'save_world_setting',
      'save_relation',
      'save_foreshadow',
      'save_item',
      'delete_character',
      'delete_world_setting',
      'delete_item',
      'delete_foreshadow',
      'create_version_snapshot',
      'get_current_state',
      'write_chapter_content',
      'append_to_chapter',
      'create_chapter',
      'create_volume',
      'rename_chapter',
      'analyze_character_emotions',
      'respond',
    ]
    for (const name of expected) {
      expect(names.has(name)).toBe(true)
    }
  })
})

// ── toOpenAITools ──

describe('toOpenAITools', () => {
  it('returns an array with the same length as AI_TOOLS', () => {
    const result = toOpenAITools()
    expect(result).toHaveLength(AI_TOOLS.length)
  })

  it('wraps each tool as { type: "function", function: { name, description, parameters } }', () => {
    const result = toOpenAITools()
    for (const item of result) {
      expect(item.type).toBe('function')
      expect(typeof item.function.name).toBe('string')
      expect(typeof item.function.description).toBe('string')
      expect(item.function.parameters).toBeDefined()
      expect(item.function.parameters.type).toBe('object')
    }
  })

  it('preserves tool names in order', () => {
    const result = toOpenAITools()
    const resultNames = result.map(t => t.function.name)
    const originalNames = AI_TOOLS.map(t => t.name)
    expect(resultNames).toEqual(originalNames)
  })
})

// ── toAnthropicTools ──

describe('toAnthropicTools', () => {
  it('returns an array with the same length as AI_TOOLS', () => {
    const result = toAnthropicTools()
    expect(result).toHaveLength(AI_TOOLS.length)
  })

  it('maps each tool to { name, description, input_schema }', () => {
    const result = toAnthropicTools()
    for (const item of result) {
      expect(typeof item.name).toBe('string')
      expect(typeof item.description).toBe('string')
      expect(item.input_schema).toBeDefined()
      expect(item.input_schema.type).toBe('object')
    }
  })

  it('does not include a "type" wrapper like OpenAI format', () => {
    const result = toAnthropicTools()
    for (const item of result) {
      expect((item as any).type).toBeUndefined()
      expect((item as any).function).toBeUndefined()
    }
  })

  it('preserves tool names in order', () => {
    const result = toAnthropicTools()
    const resultNames = result.map(t => t.name)
    const originalNames = AI_TOOLS.map(t => t.name)
    expect(resultNames).toEqual(originalNames)
  })
})

// ── toGeminiTools ──

describe('toGeminiTools', () => {
  it('returns an array with a single element', () => {
    const result = toGeminiTools()
    expect(result).toHaveLength(1)
  })

  it('the single element contains function_declarations array', () => {
    const result = toGeminiTools()
    expect(Array.isArray(result[0].function_declarations)).toBe(true)
  })

  it('function_declarations has the same length as AI_TOOLS', () => {
    const result = toGeminiTools()
    expect(result[0].function_declarations).toHaveLength(AI_TOOLS.length)
  })

  it('each function declaration has name, description, and parameters', () => {
    const result = toGeminiTools()
    for (const decl of result[0].function_declarations) {
      expect(typeof decl.name).toBe('string')
      expect(typeof decl.description).toBe('string')
      expect(decl.parameters).toBeDefined()
      expect(decl.parameters.type).toBe('object')
    }
  })

  it('preserves tool names in order', () => {
    const result = toGeminiTools()
    const declNames = result[0].function_declarations.map(d => d.name)
    const originalNames = AI_TOOLS.map(t => t.name)
    expect(declNames).toEqual(originalNames)
  })
})

// ── toOpenAIToolsCompact ──

describe('toOpenAIToolsCompact', () => {
  it('returns exactly 5 tools', () => {
    const result = toOpenAIToolsCompact()
    expect(result).toHaveLength(5)
  })

  it('contains only the expected compact tool names', () => {
    const result = toOpenAIToolsCompact()
    const names = new Set(result.map(t => t.function.name))
    expect(names.has('update_character')).toBe(true)
    expect(names.has('save_world_setting')).toBe(true)
    expect(names.has('save_item')).toBe(true)
    expect(names.has('append_to_chapter')).toBe(true)
    expect(names.has('save_foreshadow')).toBe(true)
    expect(names.size).toBe(5)
  })

  it('each compact item has type "function" with function object', () => {
    const result = toOpenAIToolsCompact()
    for (const item of result) {
      expect(item.type).toBe('function')
      expect(typeof item.function.name).toBe('string')
      expect(typeof item.function.description).toBe('string')
      expect(item.function.parameters).toBeDefined()
    }
  })

  it('compact descriptions are truncated at the first period', () => {
    const result = toOpenAIToolsCompact()
    for (const item of result) {
      // The compact converter splits on '.' and takes the first part
      expect(item.function.description).not.toContain('.')
    }
  })

  it('does not include tools outside the compact set', () => {
    const result = toOpenAIToolsCompact()
    const names = new Set(result.map(t => t.function.name))
    expect(names.has('respond')).toBe(false)
    expect(names.has('delete_character')).toBe(false)
    expect(names.has('save_outline')).toBe(false)
    expect(names.has('get_current_state')).toBe(false)
  })
})
