/**
 * LOD (Level of Detail) node plugin.
 *
 * Inspired by game-engine LOD systems: the node adapts the amount of
 * information displayed based on the current canvas zoom level.
 *
 *  zoom < 0.45  → Plot Level  : 2-3 sentence overall arc summary
 *  0.45–0.85    → Scene Level : characters / key events / conflicts
 *  zoom ≥ 0.85  → Text Level  : full upstream content (scrollable)
 *
 * Execution generates the Plot and Scene summaries via AI.
 * The output is always the full upstream text so downstream nodes
 * receive uncompressed data regardless of the current zoom.
 */
import { useViewport } from '@xyflow/react'
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import type { NodeBodyProps } from '../plugin'
import { useCanvasStore } from '@/stores/canvasStore'
import { useAIStore } from '@/stores/aiStore'
import { cn } from '@/lib/utils'

// ── LOD thresholds ─────────────────────────────────────────────────────────────

const ZOOM_SCENE = 0.45   // below this → Plot Level
const ZOOM_TEXT  = 0.85   // above this → Text Level

type LODLevel = 'plot' | 'scene' | 'text'

function getLODLevel(zoom: number): LODLevel {
  if (zoom < ZOOM_SCENE) return 'plot'
  if (zoom < ZOOM_TEXT)  return 'scene'
  return 'text'
}

const LEVEL_META: Record<LODLevel, { label: string; color: string; hint: string }> = {
  plot:  { label: '📖 Plot',  color: 'bg-purple-500', hint: '줌아웃: 핵심 요약' },
  scene: { label: '🎬 Scene', color: 'bg-blue-500',   hint: '중간: 사건·캐릭터' },
  text:  { label: '📝 Text',  color: 'bg-green-500',  hint: '줌인: 원본 텍스트' },
}

// ── Body Component ─────────────────────────────────────────────────────────────

function LODNodeBody({ nodeId, data }: NodeBodyProps) {
  const { zoom } = useViewport()
  const nodeOutput = useCanvasStore(s => s.nodeOutputs[nodeId])

  const level       = getLODLevel(zoom)
  const meta        = LEVEL_META[level]
  const plotSummary  = (data.plotSummary  as string | null) ?? ''
  const sceneSummary = (data.sceneSummary as string | null) ?? ''
  const fullText     = nodeOutput?.status === 'completed' ? nodeOutput.content : ''
  const hasData      = !!(plotSummary || sceneSummary || fullText)

  return (
    <div className="mt-1.5 space-y-1.5">

      {/* LOD level badge */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className={cn('text-white text-[8px] px-1.5 py-0.5 rounded font-semibold', meta.color)}>
          {meta.label}
        </span>
        <span className="text-[8px] text-text-muted/50">{meta.hint}</span>
        <span className="ml-auto text-[8px] text-text-muted/40">{zoom.toFixed(2)}x</span>
      </div>

      {/* Content */}
      {!hasData && (
        <p className="text-[9px] text-text-muted/50 text-center py-2 leading-relaxed">
          텍스트를 연결하고 실행하면<br />줌 레벨에 따라 요약이 표시됩니다
        </p>
      )}

      {hasData && level === 'plot' && (
        <p className="text-[9px] text-text-secondary leading-relaxed">
          {plotSummary || '플롯 요약 없음'}
        </p>
      )}

      {hasData && level === 'scene' && (
        <div className="text-[9px] text-text-secondary leading-relaxed whitespace-pre-line">
          {sceneSummary || '장면 요약 없음'}
        </div>
      )}

      {hasData && level === 'text' && (
        <div className="max-h-[180px] overflow-y-auto rounded">
          <p className="text-[9px] text-text-secondary whitespace-pre-wrap leading-relaxed break-words">
            {fullText || '본문 없음'}
          </p>
        </div>
      )}
    </div>
  )
}

// ── Plugin registration ────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'lod',
    label: 'LOD Viewer',
    labelKo: '🤖 LOD 뷰어',
    category: 'special',
    tags: ['special', 'ai'],
    color: NODE_CATEGORY_COLORS.special,
    inputs: [
      {
        id: 'in',
        label: 'Content',
        type: 'target',
        position: 'left',
        acceptsTypes: ['TEXT', 'CONTEXT'],
      },
    ],
    outputs: [
      {
        id: 'out',
        label: 'Text',
        type: 'source',
        position: 'right',
        dataType: 'TEXT',
      },
    ],
    defaultData: {
      label: '🤖 LOD 뷰어',
      plotSummary: null,
      sceneSummary: null,
    },
  },

  bodyComponent: LODNodeBody,
  isExecutable: true,

  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    if (!context.trim()) return '연결된 텍스트가 없습니다.'

    // ── AI: generate Plot & Scene summaries ───────────────────────────────────
    const { callWithTools } = await import('@/ai/providers')
    const aiStore  = useAIStore.getState()
    const provider = aiStore.activeProviders[0]
    if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')
    const config = aiStore.configs[provider]

    const systemPrompt = [
      '당신은 소설 분석 전문가입니다.',
      '주어진 소설 내용을 2단계 수준으로 요약하세요.',
      '반드시 아래 형식으로만 응답하세요:',
      '[PLOT]',
      '전체 기승전결 핵심을 2~3 문장으로 요약',
      '[SCENE]',
      '등장인물 / 주요 사건 / 갈등 요소를 각각 1줄씩 bullet(•)으로 정리 (총 3~6항목)',
    ].join('\n')

    const resp = await callWithTools(
      config,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: `다음 소설 내용을 LOD 2단계로 요약해 주세요:\n\n${context}` },
      ],
      false,
    )

    // ── Parse [PLOT] / [SCENE] sections ──────────────────────────────────────
    const raw        = resp.content
    const plotMatch  = raw.match(/\[PLOT\]\s*([\s\S]+?)(?=\[SCENE\]|$)/)
    const sceneMatch = raw.match(/\[SCENE\]\s*([\s\S]+?)$/)

    const plotSummary  = plotMatch?.[1]?.trim()  ?? ''
    const sceneSummary = sceneMatch?.[1]?.trim() ?? ''

    // Store summaries in node data so the body component can read them
    await useCanvasStore.getState().updateNodeData(node.id, { plotSummary, sceneSummary })

    // Output: always the full upstream text for downstream nodes
    return context
  },
})
