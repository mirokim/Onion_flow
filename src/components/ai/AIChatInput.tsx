import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Loader2, ChevronDown, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PromptTemplate } from '@/types'

interface AIChatInputProps {
  onSend: (content: string) => void
  isLoading: boolean
  templates: PromptTemplate[]
  onToggleDebate?: () => void
  debateActive?: boolean
}

export function AIChatInput({ onSend, isLoading, templates, onToggleDebate, debateActive }: AIChatInputProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isLoading) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isLoading, onSend])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = () => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 120) + 'px'
    }
  }

  const applyTemplate = (template: PromptTemplate) => {
    setValue(template.prompt)
    setShowTemplates(false)
    textareaRef.current?.focus()
    // Auto-resize
    setTimeout(() => {
      const el = textareaRef.current
      if (el) {
        el.style.height = 'auto'
        el.style.height = Math.min(el.scrollHeight, 120) + 'px'
      }
    }, 0)
  }

  return (
    <div className="border-t border-border bg-bg-secondary p-2 space-y-1">
      {/* Template picker */}
      {showTemplates && (
        <div className="max-h-40 overflow-y-auto rounded border border-border bg-bg-primary p-1 space-y-0.5">
          {templates.map(tmpl => (
            <button
              key={tmpl.id}
              onClick={() => applyTemplate(tmpl)}
              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-bg-hover text-text-secondary truncate"
            >
              {tmpl.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1">
        {/* Debate toggle */}
        {onToggleDebate && (
          <button
            onClick={onToggleDebate}
            className={cn(
              'p-1.5 rounded transition shrink-0',
              debateActive ? 'text-accent' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover',
            )}
            title={t('ai.debate', '토론')}
          >
            <Swords className="w-4 h-4" />
          </button>
        )}

        {/* Template toggle */}
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className={cn(
            'p-1.5 rounded transition shrink-0',
            showTemplates ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover',
          )}
          title={t('ai.templates', '템플릿')}
        >
          <ChevronDown className={cn('w-4 h-4 transition-transform', showTemplates && 'rotate-180')} />
        </button>

        {/* Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={debateActive ? '토론 주제를 입력하세요...' : t('ai.inputPlaceholder', '메시지를 입력하세요...')}
          rows={1}
          className="flex-1 resize-none bg-bg-primary border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
          disabled={isLoading}
        />

        {/* Send */}
        <button
          onClick={handleSend}
          disabled={!value.trim() || isLoading}
          className={cn(
            'p-1.5 rounded transition shrink-0',
            value.trim() && !isLoading
              ? 'bg-accent text-white hover:bg-accent/80'
              : 'text-text-muted bg-bg-tertiary cursor-not-allowed',
          )}
        >
          {isLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />
          }
        </button>
      </div>
    </div>
  )
}
