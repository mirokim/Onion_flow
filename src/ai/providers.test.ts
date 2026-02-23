/**
 * Unit tests for providers module - buildToolResultMessages.
 * Tests: OpenAI/Llama/Grok format, Anthropic format, Gemini format, unknown provider.
 */
import { describe, it, expect } from 'vitest'
import { buildToolResultMessages } from './providers'
import type { AIToolCall } from '@/types'

const sampleToolCalls: AIToolCall[] = [
  { id: 'tc-1', name: 'get_current_state', arguments: { dataType: 'characters' } },
  { id: 'tc-2', name: 'update_character', arguments: { name: 'Alice' } },
]

const sampleResults = [
  { toolCallId: 'tc-1', result: '{"characters": []}' },
  { toolCallId: 'tc-2', result: 'Character updated' },
]

describe('buildToolResultMessages', () => {
  describe('OpenAI format', () => {
    it('returns array of tool messages with tool_call_id', () => {
      const messages = buildToolResultMessages('openai', sampleToolCalls, sampleResults)

      expect(messages).toHaveLength(2)
      expect(messages[0]).toEqual({
        role: 'tool',
        content: '{"characters": []}',
        tool_call_id: 'tc-1',
      })
      expect(messages[1]).toEqual({
        role: 'tool',
        content: 'Character updated',
        tool_call_id: 'tc-2',
      })
    })
  })

  describe('Llama format (same as OpenAI)', () => {
    it('returns array of tool messages with tool_call_id', () => {
      const messages = buildToolResultMessages('llama', sampleToolCalls, sampleResults)

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('tool')
      expect(messages[0].content).toBe('{"characters": []}')
      expect(messages[0].tool_call_id).toBe('tc-1')
      expect(messages[1].role).toBe('tool')
      expect(messages[1].content).toBe('Character updated')
      expect(messages[1].tool_call_id).toBe('tc-2')
    })
  })

  describe('Grok format (same as OpenAI)', () => {
    it('returns array of tool messages with tool_call_id', () => {
      const messages = buildToolResultMessages('grok', sampleToolCalls, sampleResults)

      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('tool')
      expect(messages[0].tool_call_id).toBe('tc-1')
      expect(messages[1].role).toBe('tool')
      expect(messages[1].tool_call_id).toBe('tc-2')
    })
  })

  describe('Anthropic format', () => {
    it('returns single user message with tool_result content blocks', () => {
      const messages = buildToolResultMessages('anthropic', sampleToolCalls, sampleResults)

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe('user')
      const content = messages[0].content as Array<{
        type: string
        tool_use_id: string
        content: string
      }>
      expect(content).toHaveLength(2)
      expect(content[0]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tc-1',
        content: '{"characters": []}',
      })
      expect(content[1]).toEqual({
        type: 'tool_result',
        tool_use_id: 'tc-2',
        content: 'Character updated',
      })
    })
  })

  describe('Gemini format', () => {
    it('returns single user message with functionResponse content blocks', () => {
      const messages = buildToolResultMessages('gemini', sampleToolCalls, sampleResults)

      expect(messages).toHaveLength(1)
      expect(messages[0].role).toBe('user')
      const content = messages[0].content as Array<{
        functionResponse: { name: string; response: { result: string } }
      }>
      expect(content).toHaveLength(2)
      expect(content[0]).toEqual({
        functionResponse: {
          name: 'get_current_state',
          response: { result: '{"characters": []}' },
        },
      })
      expect(content[1]).toEqual({
        functionResponse: {
          name: 'update_character',
          response: { result: 'Character updated' },
        },
      })
    })

    it('uses empty string for name when tool call ID is not found', () => {
      const unmatchedResults = [
        { toolCallId: 'nonexistent', result: 'some result' },
      ]
      const messages = buildToolResultMessages('gemini', sampleToolCalls, unmatchedResults)

      expect(messages).toHaveLength(1)
      const content = messages[0].content as Array<{
        functionResponse: { name: string; response: { result: string } }
      }>
      expect(content[0].functionResponse.name).toBe('')
    })
  })

  describe('Unknown provider', () => {
    it('returns empty array for unknown provider', () => {
      const messages = buildToolResultMessages('unknown_provider', sampleToolCalls, sampleResults)

      expect(messages).toEqual([])
    })

    it('returns empty array for empty string provider', () => {
      const messages = buildToolResultMessages('', sampleToolCalls, sampleResults)

      expect(messages).toEqual([])
    })
  })

  describe('edge cases', () => {
    it('handles empty results array', () => {
      const messages = buildToolResultMessages('openai', sampleToolCalls, [])

      expect(messages).toEqual([])
    })

    it('handles single result for OpenAI format', () => {
      const messages = buildToolResultMessages('openai', sampleToolCalls, [sampleResults[0]])

      expect(messages).toHaveLength(1)
      expect(messages[0].tool_call_id).toBe('tc-1')
    })

    it('handles single result for Anthropic format', () => {
      const messages = buildToolResultMessages('anthropic', sampleToolCalls, [sampleResults[0]])

      expect(messages).toHaveLength(1)
      const content = messages[0].content as Array<{ type: string }>
      expect(content).toHaveLength(1)
    })
  })
})
