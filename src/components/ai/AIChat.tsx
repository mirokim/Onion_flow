import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Plus, Trash2, MessageSquare, ToggleLeft, ToggleRight, Edit3, Check } from 'lucide-react'
import { useAIStore } from '@/stores/aiStore'
import { useProjectStore } from '@/stores/projectStore'
import { AIChatMessage } from './AIChatMessage'
import { AIChatInput } from './AIChatInput'
import { cn } from '@/lib/utils'
import type { AIProvider } from '@/types'

interface AIChatProps {
  onClose: () => void
}

export function AIChat({ onClose }: AIChatProps) {
  const { t } = useTranslation()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const {
    messages,
    isLoading,
    activeProviders,
    tripleMode,
    setTripleMode,
    sendMessage,
    clearMessages,
    promptTemplates,
    conversations,
    currentConversationId,
    loadConversations,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
  } = useAIStore()

  const { currentProject } = useProjectStore()
  const projectId = currentProject?.id

  // Load conversations when project changes
  useEffect(() => {
    if (projectId) loadConversations(projectId)
  }, [projectId, loadConversations])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const anyLoading = Object.values(isLoading).some(Boolean)

  const handleSend = useCallback((content: string) => {
    sendMessage(content, projectId)
  }, [sendMessage, projectId])

  const handleNewConversation = async () => {
    if (!projectId) return
    await createConversation(projectId)
  }

  const handleSelectConversation = async (id: string) => {
    await selectConversation(id)
    setShowSidebar(false)
  }

  const handleRename = async (id: string) => {
    if (editTitle.trim()) {
      await renameConversation(id, editTitle.trim())
    }
    setEditingId(null)
  }

  const handleDelete = async (id: string) => {
    await deleteConversation(id)
  }

  return (
    <div className="fixed right-0 top-10 bottom-0 w-[400px] max-w-[90vw] bg-bg-primary border-l border-border flex flex-col z-50 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-secondary shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium">{t('ai.title', 'AI 어시스턴트')}</span>
          {activeProviders.length === 0 && (
            <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">
              {t('ai.noProvider', 'API 키 필요')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Triple mode toggle */}
          {activeProviders.length > 1 && (
            <button
              onClick={() => setTripleMode(!tripleMode)}
              className={cn(
                'p-1 rounded transition text-xs flex items-center gap-1',
                tripleMode ? 'text-accent' : 'text-text-muted hover:text-text-primary',
              )}
              title={t('ai.tripleMode', '트리플 모드')}
            >
              {tripleMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              <span className="text-[10px]">Triple</span>
            </button>
          )}

          {/* Conversation list toggle */}
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
            title={t('ai.conversations', '대화 목록')}
          >
            <MessageSquare className="w-4 h-4" />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-bg-hover text-text-muted hover:text-text-primary transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Conversation sidebar */}
      {showSidebar && (
        <div className="border-b border-border bg-bg-secondary p-2 space-y-1 max-h-60 overflow-y-auto">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-bg-hover text-accent transition"
          >
            <Plus className="w-3 h-3" />
            {t('ai.newConversation', '새 대화')}
          </button>
          <button
            onClick={() => { clearMessages(); setShowSidebar(false) }}
            className="w-full flex items-center gap-1 text-xs px-2 py-1.5 rounded hover:bg-bg-hover text-text-muted transition"
          >
            <Trash2 className="w-3 h-3" />
            {t('ai.clearMessages', '현재 대화 초기화')}
          </button>
          <div className="h-px bg-border my-1" />
          {conversations.map(conv => (
            <div
              key={conv.id}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs transition group',
                conv.id === currentConversationId ? 'bg-accent/10 text-accent' : 'hover:bg-bg-hover text-text-secondary',
              )}
            >
              {editingId === conv.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    autoFocus
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleRename(conv.id)}
                    className="flex-1 bg-bg-primary border border-border rounded px-1 py-0.5 text-xs"
                  />
                  <button onClick={() => handleRename(conv.id)} className="p-0.5 text-green-500">
                    <Check className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleSelectConversation(conv.id)}
                    className="flex-1 text-left truncate"
                  >
                    {conv.title}
                  </button>
                  <button
                    onClick={() => { setEditingId(conv.id); setEditTitle(conv.title) }}
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-text-primary transition"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleDelete(conv.id)}
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm px-6 text-center">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
            <p>{t('ai.emptyChat', '메시지를 입력하여 AI와 대화를 시작하세요.')}</p>
            <p className="text-xs mt-1 opacity-60">
              {t('ai.emptyChatHint', '캐릭터 등록, 세계관 설정, 스토리 작성 등을 요청할 수 있습니다.')}
            </p>
          </div>
        ) : (
          messages.map(msg => <AIChatMessage key={msg.id} message={msg} />)
        )}

        {/* Loading indicator */}
        {anyLoading && (
          <div className="px-3 py-2 flex items-center gap-2 text-text-muted text-xs">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{t('ai.thinking', '생각 중...')}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <AIChatInput
        onSend={handleSend}
        isLoading={anyLoading}
        templates={promptTemplates}
      />
    </div>
  )
}
