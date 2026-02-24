/**
 * DebateThread — Message list with typing indicator.
 * Ported from Onion Ring's DebateThread.tsx + MessageBubble.tsx.
 */
import { useEffect, useRef, useState } from 'react'
import { FileText, MessageCircle } from 'lucide-react'
import { useDebateStore } from '@/stores/debateStore'
import { DEBATE_PROVIDER_LABELS, DEBATE_PROVIDER_COLORS } from '@/ai/debateRoles'
import { cn } from '@/lib/utils'
import type { AIProvider, DiscussionMessage } from '@/types'

function TypingIndicator({ provider }: { provider: AIProvider }) {
  const color = DEBATE_PROVIDER_COLORS[provider] || '#888'
  const label = DEBATE_PROVIDER_LABELS[provider] || provider

  return (
    <div className="flex gap-3">
      <div className="w-1 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <div className="py-2">
        <span className="text-xs font-semibold" style={{ color }}>
          {label}
        </span>
        <div className="flex items-center gap-1.5 mt-2">
          <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" />
          <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '0.2s' }} />
          <div className="w-1.5 h-1.5 rounded-full bg-text-muted animate-pulse" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: DiscussionMessage }) {
  const isUser = message.provider === 'user'
  const isError = !!message.error
  const isJudgeEval = message.messageType === 'judge-evaluation'
  const color = isUser ? '#fbbf24' : (DEBATE_PROVIDER_COLORS[message.provider as AIProvider] || '#888')
  const label = isUser ? 'You' : (DEBATE_PROVIDER_LABELS[message.provider as AIProvider] || message.provider)
  const [expandedImage, setExpandedImage] = useState<string | null>(null)

  return (
    <>
      <div className={cn(
        'flex gap-3 group',
        isError && 'opacity-50',
        isJudgeEval && 'bg-warning/5 rounded-lg p-2.5 border border-warning/20',
      )}>
        {/* Color bar */}
        <div
          className={cn('shrink-0 rounded-full', isJudgeEval ? 'w-1' : 'w-0.5')}
          style={{ backgroundColor: isJudgeEval ? '#f59e0b' : color }}
        />

        {/* Content */}
        <div className="min-w-0 flex-1 py-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] font-semibold tracking-wide" style={{ color: isJudgeEval ? '#f59e0b' : color }}>
              {label}
            </span>
            {message.roleName && !isJudgeEval && (
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-accent/10 text-accent">
                {message.roleName}
              </span>
            )}
            {isJudgeEval && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-warning/15 text-warning">
                심판
              </span>
            )}
            <span className="text-[9px] text-text-muted font-medium px-1.5 py-0.5 rounded bg-bg-surface">
              R{message.round}
            </span>
            {isError && (
              <span className="text-[9px] text-error font-semibold px-1.5 py-0.5 rounded bg-error/10">오류</span>
            )}
          </div>

          {/* Attached files */}
          {message.files && message.files.length > 0 && (
            <div className="flex gap-2 mb-2 flex-wrap">
              {message.files.map((file) => (
                <div key={file.id} className="shrink-0">
                  {file.mimeType.startsWith('image/') ? (
                    <img
                      src={file.dataUrl}
                      alt={file.filename}
                      className="max-w-[180px] max-h-[130px] object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition"
                      onClick={() => setExpandedImage(file.dataUrl)}
                    />
                  ) : (
                    <div className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-surface rounded-lg border border-border">
                      <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="text-xs text-text-secondary truncate max-w-[130px]">{file.filename}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="text-[13px] text-text-primary whitespace-pre-wrap leading-[1.7]">
            {message.content}
          </div>
        </div>
      </div>

      {/* Image lightbox */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 cursor-pointer"
          onClick={() => setExpandedImage(null)}
        >
          <img src={expandedImage} alt="" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
        </div>
      )}
    </>
  )
}

export function DebateThread() {
  const messages = useDebateStore((s) => s.messages)
  const loadingProvider = useDebateStore((s) => s.loadingProvider)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages.length, loadingProvider])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
      {messages.length === 0 && !loadingProvider && (
        <div className="flex flex-col items-center justify-center h-full text-text-muted gap-3">
          <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center">
            <MessageCircle className="w-5 h-5" />
          </div>
          <p className="text-xs">토론이 시작되면 여기에 대화가 표시됩니다</p>
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {loadingProvider && <TypingIndicator provider={loadingProvider} />}
    </div>
  )
}
