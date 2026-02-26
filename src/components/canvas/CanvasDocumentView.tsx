/**
 * CanvasDocumentView — Shows canvas nodes as a linear document (Obsidian-style paragraph view).
 * Nodes at the current depth are sorted top-to-bottom by their y position and rendered
 * as editable paragraphs. Useful for reading/writing story beats in sequence.
 */
import { useState, useRef, useEffect } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import type { CanvasNode } from '@/types'
import { cn } from '@/lib/utils'

/** Human-readable labels for canvas node types */
const NODE_TYPE_LABELS: Record<string, string> = {
  character: '캐릭터',
  event: '이벤트',
  wiki: '위키',
  memory: '기억',
  motivation: '동기',
  storyteller: 'AI 스토리텔러',
  summarizer: '요약',
  save_content: '내용 저장',
  preview_content: '미리보기',
  group: '그룹',
  cliffhanger: '클리프행어',
  virtual_reader: '가상 독자',
  what_if: '만약에',
  show_dont_tell: '보여주기',
  tikitaka: '티키타카',
  pov: '시점',
  pacing: '페이싱',
  style_transfer: '문체 전환',
  output_format: '출력 형식',
  plot_context: '플롯 컨텍스트',
  plot_genre: '장르',
  plot_structure: '구성',
  document_load: '문서 로드',
  image_load: '이미지 로드',
}

function getNodeLabel(node: CanvasNode): string {
  return (node.data.label as string | undefined) || NODE_TYPE_LABELS[node.type] || node.type
}

function getNodeText(node: CanvasNode): string {
  return (node.data.text as string | undefined)
    || (node.data.content as string | undefined)
    || ''
}

/* ── NodeDocumentBlock ── */

function NodeDocumentBlock({ node }: { node: CanvasNode }) {
  const updateNodeData = useCanvasStore(s => s.updateNodeData)
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(getNodeText(node))
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync when node changes externally
  useEffect(() => {
    if (!editing) setText(getNodeText(node))
  }, [node.data, editing])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [text, editing])

  const handleSave = () => {
    const textKey = 'text' in node.data ? 'text' : 'content'
    updateNodeData(node.id, { [textKey]: text })
    setEditing(false)
  }

  const hasText = text.trim().length > 0
  const label = getNodeLabel(node)

  return (
    <div
      className="group border border-border rounded-lg overflow-hidden hover:border-border/80 transition-colors"
    >
      {/* Node type header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-secondary border-b border-border">
        <span className="text-[10px] font-medium text-text-muted uppercase tracking-wide">
          {label}
        </span>
      </div>

      {/* Content area */}
      <div className="px-3 py-2.5 bg-bg-primary">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={text}
            autoFocus
            onChange={e => setText(e.target.value)}
            onBlur={handleSave}
            onKeyDown={e => {
              if (e.key === 'Escape') { setText(getNodeText(node)); setEditing(false) }
            }}
            placeholder="내용을 입력하세요..."
            className="w-full bg-transparent border-none focus:outline-none text-sm text-text-primary placeholder:text-text-muted resize-none leading-relaxed min-h-[60px]"
            rows={1}
          />
        ) : (
          <div
            onClick={() => setEditing(true)}
            className={cn(
              'text-sm leading-relaxed cursor-text min-h-[2.5rem]',
              hasText ? 'text-text-primary' : 'text-text-muted italic',
            )}
          >
            {hasText ? text : '클릭하여 내용을 입력하세요...'}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── CanvasDocumentView ── */

export function CanvasDocumentView() {
  // Subscribe directly to nodes + depth path so the component re-renders on any change
  const nodes = useCanvasStore(s => {
    const parentId = s.currentDepthPath.length > 0
      ? s.currentDepthPath[s.currentDepthPath.length - 1]
      : null
    return s.nodes.filter(n => n.parentCanvasId === parentId)
  })

  // Sort by y position (top to bottom)
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y)

  if (sortedNodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted gap-2">
        <p className="text-sm">이 캔버스에는 노드가 없습니다</p>
        <p className="text-xs opacity-60">그래프 뷰에서 노드를 추가해보세요</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex flex-col gap-3 p-4 max-w-2xl mx-auto w-full">
        {sortedNodes.map(node => (
          <NodeDocumentBlock key={node.id} node={node} />
        ))}
      </div>
    </div>
  )
}
