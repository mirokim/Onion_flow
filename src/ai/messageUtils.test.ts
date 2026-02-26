/**
 * Unit tests for messageUtils — pruneHistoryMessages.
 * Pure function tests: no mocks required.
 */
import { describe, it, expect } from 'vitest'
import type { AIMessage } from '@/types'
import { pruneHistoryMessages, MAX_HISTORY_MESSAGES } from './messageUtils'

// ── Helpers ──

function makeMsg(role: AIMessage['role'], id: string): AIMessage {
  return {
    id,
    role,
    content: `${role} message ${id}`,
    timestamp: Date.now(),
  }
}

function makeToolMsg(id: string): AIMessage {
  return {
    id,
    role: 'tool',
    content: `tool result ${id}`,
    toolResults: [{ toolCallId: `tc-${id}`, success: true, result: 'ok' }],
    timestamp: Date.now(),
  }
}

function makeAssistantWithTools(id: string): AIMessage {
  return {
    id,
    role: 'assistant',
    content: '',
    toolCalls: [{ id: `tc-${id}`, name: 'update_character', arguments: { name: 'Alice' } }],
    timestamp: Date.now(),
  }
}

// ── Tests ──

describe('pruneHistoryMessages', () => {
  describe('within limit', () => {
    it('returns the same array when messages is empty', () => {
      expect(pruneHistoryMessages([], 10)).toEqual([])
    })

    it('returns as-is when messages count equals the limit', () => {
      const msgs = Array.from({ length: 10 }, (_, i) => makeMsg('user', `u${i}`))
      const result = pruneHistoryMessages(msgs, 10)
      expect(result).toHaveLength(10)
      expect(result).toBe(msgs) // same reference — no copy
    })

    it('returns as-is when messages count is below the limit', () => {
      const msgs = [makeMsg('user', 'u1'), makeMsg('assistant', 'a1')]
      const result = pruneHistoryMessages(msgs, 20)
      expect(result).toHaveLength(2)
      expect(result).toBe(msgs)
    })
  })

  describe('truncation', () => {
    it('keeps only the most recent maxMessages when over limit', () => {
      const msgs = Array.from({ length: 30 }, (_, i) => makeMsg('user', `u${i}`))
      const result = pruneHistoryMessages(msgs, 20)
      expect(result).toHaveLength(20)
      expect(result[0].id).toBe('u10')
      expect(result[19].id).toBe('u29')
    })

    it('exported MAX_HISTORY_MESSAGES constant is 20', () => {
      expect(MAX_HISTORY_MESSAGES).toBe(20)
    })
  })

  describe('leading orphan trimming', () => {
    it('removes leading tool messages after slicing', () => {
      // Construct: [tool, user, assistant, user, assistant]
      // After slice to 3: [user, assistant, user] — starts with user, no trim needed
      // Construct a case where slice starts with tool
      const msgs = [
        makeMsg('user', 'u1'),
        makeAssistantWithTools('a1'),
        makeToolMsg('t1'),
        makeMsg('user', 'u2'),
        makeMsg('assistant', 'a2'),
      ]
      // limit=3 → slice last 3: [tool, user, assistant]
      // → trim leading tool → [user, assistant]
      const result = pruneHistoryMessages(msgs, 3)
      expect(result[0].role).toBe('user')
      expect(result[0].id).toBe('u2')
    })

    it('removes leading assistant messages after slicing', () => {
      const msgs = [
        makeMsg('user', 'u1'),
        makeMsg('assistant', 'a1'),
        makeMsg('assistant', 'a2'), // orphan if we start here
        makeMsg('user', 'u2'),
        makeMsg('assistant', 'a3'),
      ]
      // limit=3 → slice last 3: [assistant(a2), user(u2), assistant(a3)]
      // → trim leading non-user → [user(u2), assistant(a3)]
      const result = pruneHistoryMessages(msgs, 3)
      expect(result[0].role).toBe('user')
      expect(result[0].id).toBe('u2')
      expect(result).toHaveLength(2)
    })

    it('preserves complete user-assistant-tool triplet when it fits', () => {
      const msgs = [
        makeMsg('user', 'u1'),
        makeMsg('assistant', 'a1'),
        makeMsg('user', 'u2'),
        makeAssistantWithTools('a2'),
        makeToolMsg('t2'),
        makeMsg('assistant', 'a3'),
      ]
      // limit=4 → slice last 4: [user(u2), assistant_with_tools(a2), tool(t2), assistant(a3)]
      // starts with user — no trim
      const result = pruneHistoryMessages(msgs, 4)
      expect(result[0].role).toBe('user')
      expect(result[0].id).toBe('u2')
      expect(result).toHaveLength(4)
    })

    it('returns empty array when all sliced messages are non-user', () => {
      const msgs = [
        makeMsg('assistant', 'a1'),
        makeMsg('assistant', 'a2'),
        makeMsg('assistant', 'a3'),
      ]
      const result = pruneHistoryMessages(msgs, 2)
      expect(result).toEqual([])
    })

    it('returns empty array for tool-only history', () => {
      const msgs = [
        makeToolMsg('t1'),
        makeToolMsg('t2'),
        makeToolMsg('t3'),
      ]
      const result = pruneHistoryMessages(msgs, 2)
      expect(result).toEqual([])
    })
  })

  describe('result always starts with user message', () => {
    it('result starts with user when starting at user boundary after slice', () => {
      const msgs = [
        makeMsg('user', 'u1'),
        makeMsg('assistant', 'a1'),
        makeMsg('user', 'u2'),
        makeMsg('assistant', 'a2'),
        makeMsg('user', 'u3'),
        makeMsg('assistant', 'a3'),
      ]
      const result = pruneHistoryMessages(msgs, 4)
      expect(result[0].role).toBe('user')
    })

    it('result starts with user after trimming when slice begins with assistant', () => {
      const msgs = Array.from({ length: 22 }, (_, i) => {
        if (i % 2 === 0) return makeMsg('user', `u${i}`)
        return makeMsg('assistant', `a${i}`)
      })
      // length=22, limit=20 → slice last 20: starts at index 2 (assistant)
      const result = pruneHistoryMessages(msgs, 20)
      expect(result[0].role).toBe('user')
    })
  })
})
