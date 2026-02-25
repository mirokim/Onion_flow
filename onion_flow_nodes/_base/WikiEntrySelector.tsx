import { useMemo } from 'react'
import { useWikiStore } from '@/stores/wikiStore'
import { useCanvasStore } from '@/stores/canvasStore'

interface WikiEntrySelectorProps {
  nodeId: string
  /** Current data record (used to read wikiEntryId without extra store subscription) */
  data: Record<string, any>
  /** 'all' = no filter, otherwise filter by e.category === category */
  category: string
  placeholder?: string
  /** Max chars for content preview. 0 = no preview. */
  maxPreview?: number
  /** Max content lines for preview (0 = no line limit) */
  maxLines?: number
}

export function WikiEntrySelector({
  nodeId,
  data,
  category,
  placeholder = '위키 항목 선택...',
  maxPreview = 100,
  maxLines = 0,
}: WikiEntrySelectorProps) {
  const allEntries = useWikiStore(s => s.entries)
  const wikiEntryId = data.wikiEntryId as string | undefined | null

  const entries = useMemo(
    () => category === 'all' ? allEntries : allEntries.filter(e => e.category === category),
    [allEntries, category],
  )

  const selected = useMemo(
    () => wikiEntryId ? allEntries.find(e => e.id === wikiEntryId) : undefined,
    [allEntries, wikiEntryId],
  )

  let preview = selected?.content ?? ''
  if (maxLines > 0 && preview) {
    preview = preview.split('\n').filter((l: string) => l.trim()).slice(0, maxLines).join('\n')
  }
  if (maxPreview > 0 && preview.length > maxPreview) {
    preview = preview.slice(0, maxPreview) + '...'
  }

  return (
    <div className="mt-1.5">
      <select
        value={wikiEntryId || ''}
        onChange={(e) => {
          e.stopPropagation()
          useCanvasStore.getState().updateNodeData(nodeId, { wikiEntryId: e.target.value || null })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
      >
        <option value="">{placeholder}</option>
        {entries.map(entry => (
          <option key={entry.id} value={entry.id}>
            {entry.title || 'Untitled'}
          </option>
        ))}
      </select>
      {maxPreview > 0 && preview && (
        <p className={`mt-1 text-[10px] text-text-muted leading-relaxed bg-bg-primary/50 rounded px-1.5 py-1 ${maxLines > 0 ? 'whitespace-pre-line line-clamp-2' : 'max-h-[60px] overflow-y-auto'}`}>
          {preview}
        </p>
      )}
    </div>
  )
}
