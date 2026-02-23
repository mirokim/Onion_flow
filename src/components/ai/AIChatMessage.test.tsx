/**
 * Unit tests for AIChatMessage component.
 * Tests: user/assistant/tool message rendering, provider badge, tool results toggle.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AIChatMessage } from './AIChatMessage'
import type { AIMessage } from '@/types'

function makeMessage(overrides: Partial<AIMessage> = {}): AIMessage {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello, AI!',
    timestamp: Date.now(),
    ...overrides,
  }
}

describe('AIChatMessage', () => {
  it('should render user message content', () => {
    render(<AIChatMessage message={makeMessage()} />)
    expect(screen.getByText('Hello, AI!')).toBeInTheDocument()
  })

  it('should render assistant message content', () => {
    render(<AIChatMessage message={makeMessage({ role: 'assistant', content: 'Hi there!' })} />)
    expect(screen.getByText('Hi there!')).toBeInTheDocument()
  })

  it('should show provider badge for assistant messages', () => {
    render(<AIChatMessage message={makeMessage({
      role: 'assistant',
      content: 'Response from Claude',
      provider: 'anthropic',
    })} />)
    expect(screen.getByText('Claude')).toBeInTheDocument()
  })

  it('should NOT show provider badge for user messages', () => {
    render(<AIChatMessage message={makeMessage({ provider: 'openai' as any })} />)
    expect(screen.queryByText('OpenAI')).not.toBeInTheDocument()
  })

  it('should render tool message with collapsible results', () => {
    const toolMsg = makeMessage({
      role: 'tool',
      content: '',
      toolResults: [
        { toolCallId: 'tc-1', success: true, result: 'Found 3 characters' },
        { toolCallId: 'tc-2', success: false, result: 'Failed to create' },
      ],
    })
    render(<AIChatMessage message={toolMsg} />)
    // Should show tool results label with count
    expect(screen.getByText(/도구 실행 결과/)).toBeInTheDocument()
    expect(screen.getByText('(1/2)')).toBeInTheDocument()
  })

  it('should expand tool results when clicked', () => {
    const toolMsg = makeMessage({
      role: 'tool',
      content: '',
      toolResults: [
        { toolCallId: 'tc-1', success: true, result: 'Found items' },
      ],
    })
    render(<AIChatMessage message={toolMsg} />)
    // Results are hidden initially
    expect(screen.queryByText('Found items')).not.toBeInTheDocument()
    // Click to expand
    fireEvent.click(screen.getByText(/도구 실행 결과/))
    expect(screen.getByText('Found items')).toBeInTheDocument()
  })

  it('should show tool call badges for assistant messages with tool calls', () => {
    render(<AIChatMessage message={makeMessage({
      role: 'assistant',
      content: 'Let me search for that',
      toolCalls: [
        { id: 'tc-1', name: 'searchCharacters', arguments: {} },
        { id: 'tc-2', name: 'getWorldSetting', arguments: {} },
      ],
    })} />)
    expect(screen.getByText('searchCharacters')).toBeInTheDocument()
    expect(screen.getByText('getWorldSetting')).toBeInTheDocument()
  })
})
