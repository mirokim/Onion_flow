/**
 * DebateUserInput — User intervention input during debate.
 * Ported from Onion Ring's UserIntervention.tsx (without camera/gallery).
 */
import { useState, useRef } from 'react'
import { Send, Paperclip, X, FileText } from 'lucide-react'
import { useDebateStore } from '@/stores/debateStore'
import { generateId } from '@/lib/utils'
import type { ReferenceFile } from '@/types'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_FILES = 5
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
const ACCEPTED_EXTENSIONS = '.png,.jpg,.jpeg,.gif,.webp,.pdf'

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function DebateUserInput() {
  const status = useDebateStore((s) => s.status)
  const userIntervene = useDebateStore((s) => s.userIntervene)
  const [input, setInput] = useState('')
  const [files, setFiles] = useState<ReferenceFile[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const disabled = status !== 'running' && status !== 'paused'
  const canSend = !disabled && (input.trim().length > 0 || files.length > 0)

  const handleSend = () => {
    if (!canSend) return
    userIntervene(input.trim(), files.length > 0 ? files : undefined)
    setInput('')
    setFiles([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileUpload = async (fileList: FileList | null) => {
    if (!fileList) return
    const newFiles: ReferenceFile[] = []
    for (const file of Array.from(fileList)) {
      if (!ACCEPTED_TYPES.includes(file.type)) continue
      if (file.size > MAX_FILE_SIZE) continue
      if (files.length + newFiles.length >= MAX_FILES) break
      const dataUrl = await readFileAsDataUrl(file)
      newFiles.push({ id: generateId(), filename: file.name, mimeType: file.type, size: file.size, dataUrl })
    }
    if (newFiles.length > 0) setFiles((prev) => [...prev, ...newFiles])
  }

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && files.length < MAX_FILES) void handleFileUpload(e.dataTransfer.files)
  }

  return (
    <div
      className="border-t border-border p-2.5 shrink-0 bg-bg-secondary/80"
      onDrop={handleDrop}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
    >
      {/* File Preview */}
      {files.length > 0 && (
        <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
          {files.map((file) => (
            <div key={file.id} className="relative shrink-0 group">
              {file.mimeType.startsWith('image/') ? (
                <img src={file.dataUrl} alt={file.filename} className="w-12 h-12 object-cover rounded-lg border border-border" />
              ) : (
                <div className="w-12 h-12 flex flex-col items-center justify-center bg-bg-surface rounded-lg border border-border">
                  <FileText className="w-4 h-4 text-text-muted" />
                  <span className="text-[7px] text-text-muted mt-0.5">PDF</span>
                </div>
              )}
              <button
                onClick={() => removeFile(file.id)}
                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-error text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow-sm"
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input Row */}
      <div className="flex gap-1.5 items-end">
        <button
          onClick={() => {
            if (disabled || files.length >= MAX_FILES) return
            fileInputRef.current?.click()
          }}
          disabled={disabled || files.length >= MAX_FILES}
          className="p-1.5 text-text-muted hover:text-accent rounded-lg hover:bg-bg-hover disabled:opacity-25 disabled:cursor-not-allowed transition shrink-0"
          title="파일 첨부"
        >
          <Paperclip className="w-3.5 h-3.5" />
        </button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? status === 'completed' || status === 'stopped'
                ? '토론이 종료되었습니다'
                : '토론이 시작되면 개입할 수 있습니다'
              : '토론에 개입하기... (Enter 전송)'
          }
          disabled={disabled}
          className="flex-1 px-3 py-1.5 text-sm bg-bg-surface border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent/40 transition disabled:opacity-40 disabled:cursor-not-allowed placeholder:text-text-muted/60"
          rows={1}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="p-1.5 bg-accent text-white rounded-lg hover:bg-accent-dim disabled:opacity-20 disabled:cursor-not-allowed transition shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFileUpload(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
