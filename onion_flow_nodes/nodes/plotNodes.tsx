/**
 * Plot node plugins: plot_genre, plot_structure, plot_context
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import { WikiEntrySelector } from '../_base/WikiEntrySelector'
import { PLOT_GENRE_OPTIONS, PLOT_STRUCTURE_OPTIONS, GENRE_GROUPS } from '../plotOptions'
import type { NodeBodyProps } from '../plugin'
import type { CanvasNode, WikiEntry } from '@/types'
import { useWikiStore } from '@/stores/wikiStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { useMemo } from 'react'

// ── plot_genre ────────────────────────────────────────────────────────────────

function PlotGenreNodeBody({ nodeId, data }: NodeBodyProps) {
  const selectedGenre = data.selectedGenre as string | null
  const selected = selectedGenre ? PLOT_GENRE_OPTIONS.find(o => o.id === selectedGenre) : null

  return (
    <div className="mt-1.5">
      <select
        value={selectedGenre || ''}
        onChange={(e) => {
          e.stopPropagation()
          useCanvasStore.getState().updateNodeData(nodeId, { selectedGenre: e.target.value || null })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
      >
        <option value="">장르 선택...</option>
        {GENRE_GROUPS.map(grp => (
          <optgroup key={grp.key} label={grp.label}>
            {PLOT_GENRE_OPTIONS.filter(o => o.group === grp.key).map(opt => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </optgroup>
        ))}
      </select>
      {selected && (
        <p className="mt-0.5 text-[9px] text-text-muted leading-relaxed bg-bg-primary/50 rounded px-1.5 py-0.5">
          {selected.description}
        </p>
      )}
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'plot_genre',
    label: 'Genre',
    labelKo: '장르',
    category: 'plot',
    tags: ['context', 'plot'],
    color: NODE_CATEGORY_COLORS.plot,
    inputs: [],
    outputs: [{ id: 'out', label: 'Genre', type: 'source', position: 'right', dataType: 'PLOT' }],
    defaultData: { selectedGenre: null, label: '장르' },
  },
  bodyComponent: PlotGenreNodeBody,
  extractData: (node) => {
    const genreId = node.data.selectedGenre as string | undefined
    if (!genreId) return null
    const opt = PLOT_GENRE_OPTIONS.find(o => o.id === genreId)
    return opt ? `[플롯 장르: ${opt.label}] ${opt.description}` : null
  },
  buildPromptSegment: (node) => {
    const genreId = node.data.selectedGenre as string | undefined
    if (!genreId) return null
    const opt = PLOT_GENRE_OPTIONS.find(o => o.id === genreId)
    if (!opt) return null
    return { role: 'plot_context', content: `[플롯 장르: ${opt.label}]\n${opt.description}`, priority: 9 }
  },
})

// ── plot_structure ────────────────────────────────────────────────────────────

function PlotStructureNodeBody({ nodeId, data }: NodeBodyProps) {
  const selectedStructure = data.selectedStructure as string | null
  const selected = selectedStructure ? PLOT_STRUCTURE_OPTIONS.find(o => o.id === selectedStructure) : null

  return (
    <div className="mt-1.5">
      <select
        value={selectedStructure || ''}
        onChange={(e) => {
          e.stopPropagation()
          useCanvasStore.getState().updateNodeData(nodeId, { selectedStructure: e.target.value || null })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
      >
        <option value="">형식 선택...</option>
        {PLOT_STRUCTURE_OPTIONS.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.label}</option>
        ))}
      </select>
      {selected && (
        <p className="mt-0.5 text-[9px] text-text-muted leading-relaxed bg-bg-primary/50 rounded px-1.5 py-0.5">
          {selected.description}
        </p>
      )}
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'plot_structure',
    label: 'Plot Structure',
    labelKo: '플롯 형식',
    category: 'plot',
    tags: ['context', 'plot'],
    color: NODE_CATEGORY_COLORS.plot,
    inputs: [],
    outputs: [{ id: 'out', label: 'Structure', type: 'source', position: 'right', dataType: 'PLOT' }],
    defaultData: { selectedStructure: null, label: '플롯 형식' },
  },
  bodyComponent: PlotStructureNodeBody,
  extractData: (node) => {
    const structId = node.data.selectedStructure as string | undefined
    if (!structId) return null
    const opt = PLOT_STRUCTURE_OPTIONS.find(o => o.id === structId)
    return opt ? `[플롯 형식: ${opt.label}] ${opt.description}` : null
  },
  buildPromptSegment: (node) => {
    const structId = node.data.selectedStructure as string | undefined
    if (!structId) return null
    const opt = PLOT_STRUCTURE_OPTIONS.find(o => o.id === structId)
    if (!opt) return null
    return { role: 'plot_context', content: `[플롯 형식: ${opt.label}]\n${opt.description}`, priority: 9 }
  },
})

// ── plot_context ──────────────────────────────────────────────────────────────

function PlotContextNodeBody({ nodeId, data }: NodeBodyProps) {
  const allEntries = useWikiStore(s => s.entries)
  const wikiEntryId = data.wikiEntryId as string | null
  const plotEntry = useMemo(
    () => wikiEntryId ? allEntries.find(e => e.id === wikiEntryId) : undefined,
    [allEntries, wikiEntryId],
  )

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
        <option value="">플롯 위키 항목...</option>
        {allEntries.filter(e => e.category === 'plot').map(entry => (
          <option key={entry.id} value={entry.id}>{entry.title || 'Untitled'}</option>
        ))}
      </select>
      {plotEntry?.content && (() => {
        const lines = plotEntry.content.split('\n').filter((l: string) => l.trim()).slice(0, 2)
        const preview = lines.join('\n')
        return (
          <p className="mt-0.5 text-[9px] text-text-muted leading-relaxed bg-bg-primary/50 rounded px-1.5 py-1 whitespace-pre-line line-clamp-2">
            {preview.length > 120 ? preview.slice(0, 120) + '...' : preview}
          </p>
        )
      })()}
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'plot_context',
    label: 'Plot',
    labelKo: '플롯',
    category: 'plot',
    tags: ['context', 'plot'],
    color: NODE_CATEGORY_COLORS.plot,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left', acceptsTypes: ['PLOT', 'CONTEXT', '*'] }],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right', dataType: 'PLOT' }],
    defaultData: { wikiEntryId: null, label: '플롯' },
  },
  bodyComponent: PlotContextNodeBody,
  extractData: (node, wikiEntries) => {
    const plotWikiId = node.data.wikiEntryId as string | undefined
    if (!plotWikiId) return null
    const entry = wikiEntries.find(e => e.id === plotWikiId)
    return entry ? `[플롯: ${entry.title}] ${entry.content || ''}` : null
  },
  buildPromptSegment: (node, wikiEntries) => {
    const plotWikiId = node.data.wikiEntryId as string | undefined
    if (!plotWikiId) return null
    const plotEntry = wikiEntries.find(e => e.id === plotWikiId)
    if (!plotEntry) return null
    return {
      role: 'plot_context',
      content: `[플롯: ${plotEntry.title}]\n${plotEntry.content || ''}`,
      priority: 9,
    }
  },
})
