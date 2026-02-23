/**
 * Unit tests for AIChatInput component.
 * Tests: rendering, sending messages, Enter key, disabled state, template picker.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AIChatInput } from './AIChatInput'
import type { PromptTemplate } from '@/types'

const templates: PromptTemplate[] = [
  { id: 't1', name: 'Character Profile', prompt: 'Create a character named {{name}}', category: 'character' },
  { id: 't2', name: 'World Building', prompt: 'Describe the world of {{setting}}', category: 'worldbuilding' },
]

describe('AIChatInput', () => {
  it('should render textarea and send button', () => {
    render(<AIChatInput onSend={vi.fn()} isLoading={false} templates={[]} />)
    expect(screen.getByPlaceholderText(/메시지를 입력/)).toBeInTheDocument()
  })

  it('should call onSend with trimmed value when send button clicked', () => {
    const onSend = vi.fn()
    render(<AIChatInput onSend={onSend} isLoading={false} templates={[]} />)
    const textarea = screen.getByPlaceholderText(/메시지를 입력/)
    fireEvent.change(textarea, { target: { value: '  Hello AI  ' } })
    // Find send button (the last button in the component)
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons[buttons.length - 1]
    fireEvent.click(sendBtn)
    expect(onSend).toHaveBeenCalledWith('Hello AI')
  })

  it('should call onSend on Enter (without Shift)', () => {
    const onSend = vi.fn()
    render(<AIChatInput onSend={onSend} isLoading={false} templates={[]} />)
    const textarea = screen.getByPlaceholderText(/메시지를 입력/)
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false })
    expect(onSend).toHaveBeenCalledWith('Test message')
  })

  it('should NOT call onSend on Shift+Enter', () => {
    const onSend = vi.fn()
    render(<AIChatInput onSend={onSend} isLoading={false} templates={[]} />)
    const textarea = screen.getByPlaceholderText(/메시지를 입력/)
    fireEvent.change(textarea, { target: { value: 'Test message' } })
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('should NOT send when input is empty', () => {
    const onSend = vi.fn()
    render(<AIChatInput onSend={onSend} isLoading={false} templates={[]} />)
    const textarea = screen.getByPlaceholderText(/메시지를 입력/)
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('should disable textarea and not send when isLoading', () => {
    const onSend = vi.fn()
    render(<AIChatInput onSend={onSend} isLoading={true} templates={[]} />)
    const textarea = screen.getByPlaceholderText(/메시지를 입력/)
    expect(textarea).toBeDisabled()
    fireEvent.change(textarea, { target: { value: 'Test' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(onSend).not.toHaveBeenCalled()
  })

  it('should show templates when template button is clicked', () => {
    render(<AIChatInput onSend={vi.fn()} isLoading={false} templates={templates} />)
    // Click template toggle (first button)
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    expect(screen.getByText('Character Profile')).toBeInTheDocument()
    expect(screen.getByText('World Building')).toBeInTheDocument()
  })

  it('should apply template prompt to textarea when template is selected', () => {
    render(<AIChatInput onSend={vi.fn()} isLoading={false} templates={templates} />)
    // Open template picker
    const buttons = screen.getAllByRole('button')
    fireEvent.click(buttons[0])
    // Click a template
    fireEvent.click(screen.getByText('Character Profile'))
    const textarea = screen.getByPlaceholderText(/메시지를 입력/) as HTMLTextAreaElement
    expect(textarea.value).toBe('Create a character named {{name}}')
  })

  it('should clear input after sending', () => {
    const onSend = vi.fn()
    render(<AIChatInput onSend={onSend} isLoading={false} templates={[]} />)
    const textarea = screen.getByPlaceholderText(/메시지를 입력/) as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Hello' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })
    expect(textarea.value).toBe('')
  })
})
