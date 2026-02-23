import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Bot, User, Wrench } from 'lucide-react'
import type { AIMessage } from '@/types'
import { cn } from '@/lib/utils'

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  gemini: 'Gemini',
  llama: 'Llama',
  grok: 'Grok',
}

const PROVIDER_COLORS: Record<string, string> = {
  openai: 'bg-green-600',
  anthropic: 'bg-orange-600',
  gemini: 'bg-blue-600',
  llama: 'bg-purple-600',
  grok: 'bg-red-600',
}

export function AIChatMessage({ message }: { message: AIMessage }) {
  const { t } = useTranslation()
  const [toolsOpen, setToolsOpen] = useState(false)
  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'

  if (isTool) {
    return (
      <div className="px-3 py-1">
        <button
          onClick={() => setToolsOpen(!toolsOpen)}
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition"
        >
          <Wrench className="w-3 h-3" />
          {toolsOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <span>{t('ai.toolResults', '도구 실행 결과')}</span>
          {message.toolResults && (
            <span className="ml-1 text-[10px]">
              ({message.toolResults.filter(r => r.success).length}/{message.toolResults.length})
            </span>
          )}
        </button>
        {toolsOpen && (
          <div className="mt-1 ml-4 space-y-1">
            {message.toolResults?.map((r, i) => (
              <div key={i} className="text-xs p-1.5 rounded bg-bg-secondary border border-border">
                <span className={r.success ? 'text-green-500' : 'text-red-500'}>
                  {r.success ? '✓' : '✗'}
                </span>
                <span className="ml-1 text-text-muted whitespace-pre-wrap">{r.result}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={cn('px-3 py-2 flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5',
        isUser ? 'bg-accent' : 'bg-bg-tertiary',
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-white" />
          : <Bot className="w-3.5 h-3.5 text-text-muted" />
        }
      </div>

      {/* Content */}
      <div className={cn('max-w-[85%] space-y-1', isUser ? 'items-end' : 'items-start')}>
        {/* Provider badge */}
        {!isUser && message.provider && (
          <span className={cn(
            'inline-block text-[10px] text-white px-1.5 py-0.5 rounded-full',
            PROVIDER_COLORS[message.provider] || 'bg-gray-500',
          )}>
            {PROVIDER_LABELS[message.provider] || message.provider}
          </span>
        )}

        {/* Message bubble */}
        <div className={cn(
          'text-sm rounded-lg px-3 py-2 whitespace-pre-wrap break-words',
          isUser
            ? 'bg-accent text-white'
            : 'bg-bg-secondary text-text-primary border border-border',
        )}>
          {message.content}
        </div>

        {/* Tool calls summary */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.toolCalls.map((tc, i) => (
              <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted border border-border">
                <Wrench className="w-2.5 h-2.5 inline mr-0.5" />
                {tc.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
