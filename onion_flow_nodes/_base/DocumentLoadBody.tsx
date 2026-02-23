import { useEffect, useRef, useCallback } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { generateId } from '@/lib/utils'
import { FileText, Upload, X } from 'lucide-react'

interface DocumentLoadBodyProps {
  data: Record<string, any>
  nodeId: string
  selected: boolean
}

export function DocumentLoadBody({ data, nodeId, selected }: DocumentLoadBodyProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const documents = (data.documents || []) as Array<{
    id: string; name: string; content: string; data?: string; mimeType: string; addedAt: number
  }>

  const addDocument = useCallback((doc: (typeof documents)[number]) => {
    const existing = (useCanvasStore.getState().nodes.find(n => n.id === nodeId)?.data.documents || []) as typeof documents
    useCanvasStore.getState().updateNodeData(nodeId, {
      documents: [...existing, doc],
    })
  }, [nodeId])

  const removeDocument = useCallback((docId: string) => {
    const existing = (useCanvasStore.getState().nodes.find(n => n.id === nodeId)?.data.documents || []) as typeof documents
    useCanvasStore.getState().updateNodeData(nodeId, {
      documents: existing.filter(d => d.id !== docId),
    })
  }, [nodeId])

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        const reader = new FileReader()
        reader.onload = () => {
          addDocument({
            id: generateId(),
            name: file.name,
            content: reader.result as string,
            mimeType: 'text/plain',
            addedAt: Date.now(),
          })
        }
        reader.readAsText(file)
      } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        const reader = new FileReader()
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          addDocument({
            id: generateId(),
            name: file.name,
            content: '',
            data: base64,
            mimeType: 'application/pdf',
            addedAt: Date.now(),
          })
        }
        reader.readAsDataURL(file)
      }
    }
  }, [addDocument])

  // Ctrl+V paste — active only when selected
  useEffect(() => {
    if (!selected) return
    const handlePaste = (e: ClipboardEvent) => {
      // Check for image first — if image found, don't handle here (image_load handles it)
      const items = e.clipboardData?.items
      if (items) {
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) return
        }
      }

      const text = e.clipboardData?.getData('text/plain')
      if (text && text.trim()) {
        e.preventDefault()
        addDocument({
          id: generateId(),
          name: `paste-${new Date().toLocaleString('ko-KR').replace(/[/: ]/g, '-')}.txt`,
          content: text,
          mimeType: 'text/plain',
          addedAt: Date.now(),
        })
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [selected, addDocument])

  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-text-muted flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {documents.length}개 문서
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[10px] text-accent hover:text-accent/80 flex items-center gap-0.5"
        >
          <Upload className="w-2.5 h-2.5" /> 추가
        </button>
      </div>

      {documents.length > 0 && (
        <div className="space-y-1 max-h-[80px] overflow-y-auto">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-start gap-1 bg-bg-primary/50 rounded px-1.5 py-0.5 group">
              <FileText className="w-3 h-3 shrink-0 mt-0.5 text-text-muted" />
              <div className="flex-1 min-w-0">
                <div className="text-[10px] text-text-primary truncate">{doc.name}</div>
                {doc.content && (
                  <div className="text-[9px] text-text-muted truncate">
                    {doc.content.slice(0, 60)}{doc.content.length > 60 ? '...' : ''}
                  </div>
                )}
                {doc.mimeType === 'application/pdf' && !doc.content && (
                  <div className="text-[9px] text-text-muted italic">PDF</div>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeDocument(doc.id) }}
                onMouseDown={(e) => e.stopPropagation()}
                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.pdf"
        multiple
        className="hidden"
        onChange={(e) => { handleFileUpload(e.target.files); e.target.value = '' }}
      />

      {selected && documents.length === 0 && (
        <div className="text-[9px] text-text-muted text-center mt-1 italic">
          Ctrl+V로 텍스트 붙여넣기
        </div>
      )}
    </div>
  )
}
