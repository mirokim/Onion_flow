/**
 * Direction node plugins: pov, pacing, style_transfer, output_format
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import { StyleTransferNodeBody } from '../_base/StyleTransferNodeBody'
import { OUTPUT_FORMAT_OPTIONS, OUTPUT_FORMAT_GROUPS } from '../plotOptions'
import type { NodeBodyProps } from '../plugin'
import { useWikiStore } from '@/stores/wikiStore'
import { useCanvasStore } from '@/stores/canvasStore'

// ── pov ───────────────────────────────────────────────────────────────────────

function PovNodeBody({ nodeId, data }: NodeBodyProps) {
  const allWikiEntries = useWikiStore(s => s.entries)

  return (
    <div className="mt-1.5 space-y-1.5">
      <div>
        <label className="block text-[9px] text-text-muted mb-0.5">시점</label>
        <select
          value={data.povType || 'third_limited'}
          onChange={(e) => {
            e.stopPropagation()
            useCanvasStore.getState().updateNodeData(nodeId, { povType: e.target.value })
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
        >
          <option value="first">1인칭</option>
          <option value="third_limited">3인칭 제한</option>
          <option value="third_omniscient">3인칭 전지적</option>
          <option value="second">2인칭</option>
        </select>
      </div>
      <div>
        <label className="block text-[9px] text-text-muted mb-0.5">초점 캐릭터 (선택)</label>
        <select
          value={data.characterId || ''}
          onChange={(e) => {
            e.stopPropagation()
            useCanvasStore.getState().updateNodeData(nodeId, { characterId: e.target.value || null })
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
        >
          <option value="">없음</option>
          {allWikiEntries.filter(e => e.category === 'character').map(entry => (
            <option key={entry.id} value={entry.id}>{entry.title || 'Untitled'}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'pov',
    label: 'POV Control',
    labelKo: '시점 제어',
    category: 'direction',
    tags: ['direction'],
    color: NODE_CATEGORY_COLORS.direction,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left', acceptsTypes: ['DIRECTION', '*'] }],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right', dataType: 'DIRECTION' }],
    defaultData: { povType: 'third_limited', characterId: null, label: 'POV' },
  },
  bodyComponent: PovNodeBody,
  extractData: (node, wikiEntries) => {
    const povTypes: Record<string, string> = {
      first: '1인칭', second: '2인칭',
      third_limited: '3인칭 제한', third_omniscient: '3인칭 전지적',
    }
    const povType = (node.data.povType as string) || 'third_limited'
    const povLabel = povTypes[povType] || povType
    const charId = node.data.characterId as string | undefined
    const focusChar = charId ? wikiEntries.find(e => e.id === charId)?.title : undefined
    return `[시점] ${povLabel}${focusChar ? ` (초점: ${focusChar})` : ''}`
  },
  buildPromptSegment: (node, wikiEntries) => {
    const povTypes: Record<string, string> = {
      first: '1인칭', second: '2인칭',
      third_limited: '3인칭 제한', third_omniscient: '3인칭 전지적',
    }
    const povType = (node.data.povType as string) || 'third_limited'
    const povLabel = povTypes[povType] || povType
    const charId = node.data.characterId as string | undefined
    const focusChar = charId ? wikiEntries.find(e => e.id === charId)?.title : undefined
    return {
      role: 'direction',
      content: `[시점 제어]\n시점: ${povLabel}${focusChar ? `\n초점 캐릭터: ${focusChar}` : ''}`,
      priority: 7,
    }
  },
})

// ── pacing ────────────────────────────────────────────────────────────────────

function PacingNodeBody({ nodeId, data }: NodeBodyProps) {
  return (
    <div className="mt-1.5 space-y-1.5">
      <div>
        <label className="block text-[9px] text-text-muted mb-0.5">
          긴장감: <span className="text-text-primary font-semibold">{data.tension ?? 5}/10</span>
        </label>
        <input
          type="range"
          min={1} max={10} step={1}
          value={data.tension ?? 5}
          onChange={(e) => {
            e.stopPropagation()
            useCanvasStore.getState().updateNodeData(nodeId, { tension: Number(e.target.value) })
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="nodrag w-full h-1.5 accent-accent cursor-pointer"
        />
      </div>
      <div>
        <label className="block text-[9px] text-text-muted mb-0.5">호흡</label>
        <select
          value={data.speed || 'normal'}
          onChange={(e) => {
            e.stopPropagation()
            useCanvasStore.getState().updateNodeData(nodeId, { speed: e.target.value })
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
        >
          <option value="slow">느림 — 묘사 중심, 여운</option>
          <option value="normal">보통 — 균형 잡힌 서술</option>
          <option value="fast">빠름 — 짧은 문장, 긴박감</option>
        </select>
      </div>
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'pacing',
    label: 'Pacing',
    labelKo: '텐션/호흡',
    category: 'direction',
    tags: ['direction'],
    color: NODE_CATEGORY_COLORS.direction,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left', acceptsTypes: ['DIRECTION', '*'] }],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right', dataType: 'DIRECTION' }],
    defaultData: { tension: 5, speed: 'normal', label: 'Pacing' },
  },
  bodyComponent: PacingNodeBody,
  extractData: (node) => {
    const tension = node.data.tension || 5
    const speedLabels: Record<string, string> = { slow: '느림', normal: '보통', fast: '빠름' }
    const speed = (node.data.speed as string) || 'normal'
    return `[텐션] ${tension}/10, 호흡: ${speedLabels[speed] || speed}`
  },
  buildPromptSegment: (node) => {
    const tension = (node.data.tension as number) || 5
    const speedLabels: Record<string, string> = { slow: '느림', normal: '보통', fast: '빠름' }
    const speed = (node.data.speed as string) || 'normal'
    return {
      role: 'direction',
      content: `[텐션/호흡]\n긴장감: ${tension}/10\n호흡: ${speedLabels[speed] || speed}`,
      priority: 7,
    }
  },
})

// ── style_transfer ────────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'style_transfer',
    label: 'Style Transfer',
    labelKo: '문체 학습',
    category: 'direction',
    tags: ['direction', 'ai'],
    color: NODE_CATEGORY_COLORS.direction,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left', acceptsTypes: ['DIRECTION', '*'] }],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right', dataType: 'DIRECTION' }],
    defaultData: { sampleText: '', authorName: '', styleFilePath: '', label: 'Style' },
  },
  bodyComponent: StyleTransferNodeBody,
  extractData: (node) => {
    const sampleText = (node.data.sampleText || '') as string
    const authorName = (node.data.authorName || '') as string
    const parts: string[] = []
    if (authorName) parts.push(`참고 작가: ${authorName}`)
    if (sampleText) parts.push(`문체 샘플: ${sampleText.slice(0, 200)}`)
    return parts.length > 0 ? `[문체] ${parts.join('\n')}` : null
  },
  buildPromptSegment: (node) => {
    const sampleText = (node.data.sampleText as string) || ''
    const authorName = (node.data.authorName as string) || ''
    const parts: string[] = ['[문체 학습]']
    if (authorName) parts.push(`참고 작가: ${authorName}`)
    if (sampleText) parts.push(`다음 문체를 참고하여 작성:\n${sampleText}`)
    if (parts.length <= 1) return null
    return { role: 'direction', content: parts.join('\n'), priority: 6 }
  },
})

// ── output_format ─────────────────────────────────────────────────────────────

function OutputFormatNodeBody({ nodeId, data }: NodeBodyProps) {
  const selectedFormat = data.selectedFormat as string | null
  const selected = selectedFormat ? OUTPUT_FORMAT_OPTIONS.find(o => o.id === selectedFormat) : null

  return (
    <div className="mt-1.5">
      <select
        value={selectedFormat || ''}
        onChange={(e) => {
          e.stopPropagation()
          useCanvasStore.getState().updateNodeData(nodeId, { selectedFormat: e.target.value || null })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
      >
        <option value="">형식 선택...</option>
        {OUTPUT_FORMAT_GROUPS.map(grp => (
          <optgroup key={grp.key} label={grp.label}>
            {OUTPUT_FORMAT_OPTIONS.filter(o => o.group === grp.key).map(opt => (
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
    type: 'output_format',
    label: 'Output Format',
    labelKo: '출력 형식',
    category: 'direction',
    tags: ['direction'],
    color: NODE_CATEGORY_COLORS.direction,
    inputs: [],
    outputs: [{ id: 'out', label: 'Format', type: 'source', position: 'right', dataType: 'DIRECTION' }],
    defaultData: { selectedFormat: null, label: '출력 형식' },
  },
  bodyComponent: OutputFormatNodeBody,
  extractData: (node) => {
    const formatId = node.data.selectedFormat as string | undefined
    if (!formatId) return null
    const opt = OUTPUT_FORMAT_OPTIONS.find(o => o.id === formatId)
    return opt ? `[출력 형식: ${opt.label}] ${opt.description}` : null
  },
  buildPromptSegment: (node) => {
    const formatId = node.data.selectedFormat as string | undefined
    if (!formatId) return null
    const opt = OUTPUT_FORMAT_OPTIONS.find(o => o.id === formatId)
    if (!opt) return null
    return { role: 'direction', content: `[출력 형식: ${opt.label}]\n${opt.description}`, priority: 6 }
  },
})
