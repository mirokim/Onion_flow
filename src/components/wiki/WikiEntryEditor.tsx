import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Trash2, Tag } from 'lucide-react'
import { useWikiStore } from '@/stores/wikiStore'
import { useSaveStatusStore } from '@/stores/saveStatusStore'
import type { WikiEntry } from '@/types'
import type { PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { WIKI_CATEGORIES } from './WikiCategoryList'
import { cn } from '@/lib/utils'

interface WikiEntryEditorProps {
  entry: WikiEntry
  onBack: () => void
  panelDragHandlers?: PanelDragHandlers
}

function AutoTextarea({ value, onChange, placeholder, className }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto'
      ref.current.style.height = ref.current.scrollHeight + 'px'
    }
  }, [value])

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      rows={1}
    />
  )
}

export function WikiEntryEditor({ entry, onBack, panelDragHandlers }: WikiEntryEditorProps) {
  const { updateEntry, deleteEntry } = useWikiStore()
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content)
  const [tagInput, setTagInput] = useState('')
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleManuallySetRef = useRef(!!entry.title)

  useEffect(() => {
    setTitle(entry.title)
    setContent(entry.content)
    titleManuallySetRef.current = !!entry.title
  }, [entry.id])

  const debouncedSave = useCallback((updates: Partial<WikiEntry>) => {
    useSaveStatusStore.getState().setModified()
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      useSaveStatusStore.getState().setSaving()
      await updateEntry(entry.id, updates)
      useSaveStatusStore.getState().setSaved()
    }, 400)
  }, [entry.id, updateEntry])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    titleManuallySetRef.current = v.trim().length > 0
    debouncedSave({ title: v })
  }

  const handleContentChange = (v: string) => {
    setContent(v)
    // Auto-generate title from first line if title was not manually set
    if (!titleManuallySetRef.current) {
      const firstLine = v.split('\n')[0].trim().slice(0, 100)
      if (firstLine) {
        setTitle(firstLine)
        debouncedSave({ content: v, title: firstLine })
        return
      }
    }
    debouncedSave({ content: v })
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (!tag || entry.tags.includes(tag)) return
    const newTags = [...entry.tags, tag]
    updateEntry(entry.id, { tags: newTags })
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    const newTags = entry.tags.filter(t => t !== tag)
    updateEntry(entry.id, { tags: newTags })
  }

  const handleDelete = () => {
    deleteEntry(entry.id)
    onBack()
  }

  const catMeta = WIKI_CATEGORIES.find(c => c.key === entry.category)

  return (
    <div className="flex flex-col h-full">
      <div
        className={cn(
          "flex items-center gap-1 px-2 py-1.5 border-b border-border",
          panelDragHandlers && "cursor-grab active:cursor-grabbing",
        )}
        draggable={!!panelDragHandlers}
        onDragStart={(e) => panelDragHandlers?.onDragStart(e)}
        onDragEnd={() => panelDragHandlers?.onDragEnd()}
      >
        <button
          onClick={onBack}
          className="p-1 rounded hover:bg-bg-hover text-text-secondary"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-text-muted px-1.5 py-0.5 bg-bg-hover rounded">
          {catMeta?.labelKo ?? entry.category}
        </span>
        <div className="flex-1" />
        <button
          onClick={handleDelete}
          className="p-1 rounded hover:bg-red-500/10 text-text-muted hover:text-red-400"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Title"
          className="text-sm font-semibold bg-transparent border-none focus:outline-none text-text-primary placeholder:text-text-muted"
        />

        <AutoTextarea
          value={content}
          onChange={handleContentChange}
          placeholder="Write content..."
          className="text-xs bg-transparent border-none focus:outline-none text-text-primary placeholder:text-text-muted resize-none leading-relaxed min-h-[200px]"
        />

        <div className="border-t border-border pt-2">
          <div className="flex items-center gap-1 mb-1.5">
            <Tag className="w-3 h-3 text-text-muted" />
            <span className="text-[10px] text-text-muted">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {entry.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded cursor-pointer hover:bg-accent/20"
                onClick={() => handleRemoveTag(tag)}
              >
                {tag} &times;
              </span>
            ))}
          </div>
          <div className="flex gap-1">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
              placeholder="Add tag..."
              className="flex-1 text-[10px] px-2 py-1 bg-bg-hover border border-border rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-muted"
            />
          </div>
        </div>

        {entry.linkedEntityId && (
          <div className="text-[10px] text-text-muted border-t border-border pt-2">
            Linked: {entry.linkedEntityType} ({entry.linkedEntityId.slice(0, 8)}...)
          </div>
        )}
      </div>
    </div>
  )
}
