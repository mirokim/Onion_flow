/**
 * Message history utilities for AI conversation management.
 * Provides context window pruning to avoid Input Token rate limits.
 */
import type { AIMessage } from '@/types'

/** Maximum number of conversation messages sent to the API per request. */
export const MAX_HISTORY_MESSAGES = 20

/**
 * Prune conversation history to the most recent `maxMessages` messages.
 *
 * Rules:
 * 1. If within limit, return as-is.
 * 2. Slice to the last `maxMessages` entries.
 * 3. Trim any leading non-user messages so the history always starts with a
 *    `user` message — orphaned `tool` messages at the start would cause a 400
 *    from all providers (tool results must follow an assistant tool-call message).
 */
export function pruneHistoryMessages(messages: AIMessage[], maxMessages: number): AIMessage[] {
  if (messages.length <= maxMessages) return messages

  const sliced = messages.slice(-maxMessages)

  // Find the first user message to ensure we start at a clean turn boundary
  const firstUserIdx = sliced.findIndex(m => m.role === 'user')
  if (firstUserIdx > 0) return sliced.slice(firstUserIdx)

  // If no user message found (edge case: all tool/assistant), return empty
  // to avoid sending malformed history to the API.
  if (firstUserIdx === -1) return []

  return sliced
}
