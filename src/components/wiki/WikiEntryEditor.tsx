import { useState, useEffect, useRef, useCallback } from 'react'
import { ArrowLeft, Trash2, Tag } from 'lucide-react'
import { useWikiStore } from '@/stores/wikiStore'
import { useWorldStore } from '@/stores/worldStore'
import { useProjectStore } from '@/stores/projectStore'
import { deleteEntryWithUndo, updateEntryWithUndo } from '@/stores/undoWikiActions'
import { useSaveStatusStore } from '@/stores/saveStatusStore'
import type { WikiEntry } from '@/types'
import type { PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { WIKI_CATEGORIES } from './WikiCategoryList'
import { CharacterWikiFields } from './CharacterWikiFields'
import { WikiContentContextMenu } from './WikiContentContextMenu'
import { cn } from '@/lib/utils'

interface WikiEntryEditorProps {
  entry: WikiEntry
  onBack: () => void
  panelDragHandlers?: PanelDragHandlers
}

function AutoTextarea({ value, onChange, placeholder, className, textareaRef, onContextMenu }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const internalRef = useRef<HTMLTextAreaElement>(null)
  const ref = textareaRef ?? internalRef

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
      onContextMenu={onContextMenu}
      rows={1}
    />
  )
}

/** Hook: for character wiki entries, auto-create & link a Character entity if not already linked */
function useAutoLinkedCharacter(entry: WikiEntry) {
  const [charId, setCharId] = useState<string | null>(entry.linkedEntityId ?? null)
  const didLink = useRef(false)

  useEffect(() => {
    // Reset when entry changes
    setCharId(entry.linkedEntityId ?? null)
    didLink.current = false
  }, [entry.id, entry.linkedEntityId])

  useEffect(() => {
    if (entry.category !== 'character') return
    if (charId) return // already linked
    if (didLink.current) return // prevent double run
    didLink.current = true

    ;(async () => {
      const project = useProjectStore.getState().currentProject
      if (!project) return

      // Create a new character and link it to this wiki entry
      const character = await useWorldStore.getState().createCharacter(project.id, entry.title || 'New Character')
      await useWikiStore.getState().updateEntry(entry.id, {
        linkedEntityId: character.id,
        linkedEntityType: 'character',
      })
      setCharId(character.id)
    })()
  }, [entry.id, entry.category, entry.title, charId])

  return charId
}

export function WikiEntryEditor({ entry, onBack, panelDragHandlers }: WikiEntryEditorProps) {
  const { updateEntry, deleteEntry } = useWikiStore()
  const [title, setTitle] = useState(entry.title)
  const [content, setContent] = useState(entry.content)
  const [tagInput, setTagInput] = useState('')
  const [contentContextMenu, setContentContextMenu] = useState<{ x: number; y: number } | null>(null)
  const contentTextareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleManuallySetRef = useRef(!!entry.title)

  // Auto-link character for character wiki entries
  const linkedCharacterId = useAutoLinkedCharacter(entry)
  const isCharacterEntry = entry.category === 'character'

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
      await updateEntryWithUndo(entry.id, updates, `wiki-content-${entry.id}`)
      useSaveStatusStore.getState().setSaved()
    }, 400)
  }, [entry.id])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    titleManuallySetRef.current = v.trim().length > 0
    debouncedSave({ title: v })

    // Also sync name to linked character
    if (isCharacterEntry && linkedCharacterId) {
      useWorldStore.getState().updateCharacter(linkedCharacterId, { name: v })
    }
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
    updateEntryWithUndo(entry.id, { tags: newTags })
    setTagInput('')
  }

  const handleRemoveTag = (tag: string) => {
    const newTags = entry.tags.filter(t => t !== tag)
    updateEntryWithUndo(entry.id, { tags: newTags })
  }

  const handleDelete = () => {
    deleteEntryWithUndo(entry.id)
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

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder={isCharacterEntry ? "캐릭터 이름" : "Title"}
          className="text-base font-bold bg-transparent border-none focus:outline-none text-text-primary placeholder:text-text-muted"
        />

        <AutoTextarea
          value={content}
          onChange={handleContentChange}
          placeholder={isCharacterEntry ? "캐릭터 설명, 배경 스토리..." : "Write content..."}
          className="text-sm bg-transparent border-none focus:outline-none text-text-primary placeholder:text-text-muted resize-none leading-relaxed min-h-[120px]"
          textareaRef={contentTextareaRef}
          onContextMenu={(e) => {
            e.preventDefault()
            setContentContextMenu({ x: e.clientX, y: e.clientY })
          }}
        />

        {/* Character detail fields */}
        {isCharacterEntry && linkedCharacterId && (
          <div className="border-t border-border pt-3">
            <CharacterWikiFields characterId={linkedCharacterId} />
          </div>
        )}

        <div className="border-t border-border pt-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Tag className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs text-text-muted">Tags</span>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {entry.tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center gap-0.5 text-xs px-2 py-0.5 bg-accent/10 text-accent rounded cursor-pointer hover:bg-accent/20"
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
              className="flex-1 text-xs px-2.5 py-1.5 bg-bg-hover border border-border rounded focus:outline-none focus:border-accent text-text-primary placeholder:text-text-muted"
            />
          </div>
        </div>
      </div>

      {/* Content context menu */}
      <WikiContentContextMenu
        entry={entry}
        position={contentContextMenu}
        textareaRef={contentTextareaRef}
        onClose={() => setContentContextMenu(null)}
        onDelete={() => onBack()}
      />
    </div>
  )
}
