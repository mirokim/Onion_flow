/**
 * Brainstorming node plugin.
 *
 * Connects to plot / character nodes and generates up to 5 branching
 * continuations.  Execution pauses (isExecuting remains true) until the
 * user picks one of the AI-generated choices in the node body.
 *
 * Modes
 *  - plot      : suggest N alternative next-plot directions
 *  - character : suggest N alternative character-appearance scenarios
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import type { NodeBodyProps } from '../plugin'
import { useCanvasStore } from '@/stores/canvasStore'
import { useAIStore } from '@/stores/aiStore'
import { cn } from '@/lib/utils'
import { waitForSelection, resolveSelection } from '@/ai/brainstormingWaiter'

// ── Body Component ─────────────────────────────────────────────────────────────

function BrainstormingNodeBody({ nodeId, data }: NodeBodyProps) {
  const nodeOutput = useCanvasStore(s => s.nodeOutputs[nodeId])
  const isWaiting = nodeOutput?.status === 'waiting'
  const choices = (nodeOutput?.choices ?? []) as string[]
  const selectedChoice = data.selectedChoice as string | null

  return (
    <div className="mt-1.5 space-y-1.5">

      {/* ── Config UI (hidden while waiting for selection) ── */}
      {!isWaiting && (
        <>
          {/* Mode selector: 플롯 / 캐릭터 */}
          <div className="flex gap-0.5">
            {(['plot', 'character'] as const).map((m) => (
              <button
                key={m}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  useCanvasStore.getState().updateNodeData(nodeId, { mode: m })
                }}
                className={cn(
                  'flex-1 text-[9px] py-0.5 rounded border transition-colors',
                  (data.mode || 'plot') === m
                    ? 'bg-accent text-white border-accent'
                    : 'bg-bg-primary text-text-muted border-border hover:border-accent',
                )}
              >
                {m === 'plot' ? '📖 플롯' : '👤 캐릭터'}
              </button>
            ))}
          </div>

          {/* Branch count slider */}
          <div>
            <label className="block text-[9px] text-text-muted mb-0.5">
              분기 수: <span className="text-text-primary font-semibold">{data.count ?? 3}</span>
            </label>
            <input
              type="range" min={1} max={5} step={1}
              value={data.count ?? 3}
              onChange={(e) => {
                e.stopPropagation()
                useCanvasStore.getState().updateNodeData(nodeId, { count: Number(e.target.value) })
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="nodrag w-full h-1.5 accent-accent cursor-pointer"
            />
          </div>

          {/* Show previously selected choice */}
          {selectedChoice && (
            <div className="text-[9px] text-green-400 bg-green-500/10 rounded px-2 py-1 border border-green-500/20 leading-relaxed">
              <span className="font-bold block mb-0.5">✓ 선택됨</span>
              {selectedChoice.length > 100
                ? selectedChoice.slice(0, 100) + '…'
                : selectedChoice}
            </div>
          )}
        </>
      )}

      {/* ── Waiting: show AI-generated choices ── */}
      {isWaiting && (
        <div className="space-y-1">
          <p className="text-[9px] text-blue-400 font-semibold animate-pulse">
            분기를 선택하세요 ↓
          </p>
          {choices.length === 0 && (
            <p className="text-[9px] text-text-muted">선택지를 불러오는 중...</p>
          )}
          {choices.map((choice, idx) => (
            <button
              key={idx}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                // Persist selection and resume execution
                useCanvasStore.getState().updateNodeData(nodeId, { selectedChoice: choice })
                resolveSelection(nodeId, choice)
              }}
              className="w-full text-left text-[9px] px-2 py-1.5 rounded border border-border bg-bg-primary hover:border-blue-400 hover:bg-blue-500/10 active:bg-blue-500/20 transition-colors text-text-secondary leading-relaxed nodrag"
            >
              <span className="text-blue-400 font-bold mr-1">{idx + 1}.</span>
              {choice}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Plugin registration ────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'brainstorming',
    label: 'Brainstorming',
    labelKo: '브레인스토밍',
    category: 'special',
    tags: ['special', 'ai'],
    color: NODE_CATEGORY_COLORS.special,
    inputs: [
      {
        id: 'plot',
        label: 'Plot',
        type: 'target',
        position: 'left',
        acceptsTypes: ['PLOT', 'CONTEXT', 'TEXT'],
      },
      {
        id: 'character',
        label: 'Character',
        type: 'target',
        position: 'left',
        acceptsTypes: ['CHARACTER', 'CONTEXT'],
      },
    ],
    outputs: [
      {
        id: 'out',
        label: 'Branch',
        type: 'source',
        position: 'right',
        dataType: 'TEXT',
      },
    ],
    defaultData: {
      mode: 'plot',
      count: 3,
      label: '브레인스토밍',
      selectedChoice: null,
    },
  },

  bodyComponent: BrainstormingNodeBody,
  isExecutable: true,

  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    if (!context.trim()) {
      return '플롯 또는 캐릭터 노드를 연결해 컨텍스트를 제공해 주세요.'
    }

    const mode  = (node.data.mode  as string) || 'plot'
    const count = (node.data.count as number) || 3

    // ── 1. Build AI prompt ────────────────────────────────────────────────────
    const systemPrompt = mode === 'plot'
      ? [
          '당신은 소설 플롯 전문가입니다.',
          `다음 내용을 바탕으로 가능한 다음 플롯 전개를 ${count}가지 제안하세요.`,
          '각 제안은 2~3문장으로 간결하고 구체적으로 작성하세요.',
          '반드시 아래 형식으로만 응답하세요 (다른 설명 없이):',
          '[1] 제안 내용',
          '[2] 제안 내용',
          '...',
        ].join('\n')
      : [
          '당신은 소설 캐릭터 전문가입니다.',
          `다음 플롯/상황을 바탕으로 등장할 수 있는 캐릭터나 캐릭터의 행동을 ${count}가지 제안하세요.`,
          '각 제안은 2~3문장으로 간결하고 구체적으로 작성하세요.',
          '반드시 아래 형식으로만 응답하세요 (다른 설명 없이):',
          '[1] 제안 내용',
          '[2] 제안 내용',
          '...',
        ].join('\n')

    const userPrompt = [
      `다음 내용을 바탕으로 ${count}가지 ${mode === 'plot' ? '플롯 전개' : '캐릭터 등장'} 분기를 제안해 주세요:`,
      '',
      context,
    ].join('\n')

    // ── 2. Call AI ────────────────────────────────────────────────────────────
    const { callWithTools } = await import('@/ai/providers')
    const aiStore = useAIStore.getState()
    const provider = aiStore.activeProviders[0]
    if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')
    const config = aiStore.configs[provider]

    const resp = await callWithTools(
      config,
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      false,
    )

    // ── 3. Parse [1] … [N] format ─────────────────────────────────────────────
    const raw = resp.content
    let choices: string[] = []

    // Primary: match [N] blocks
    const regex = /\[(\d+)\]\s*([\s\S]+?)(?=\[\d+\]|$)/g
    let m: RegExpExecArray | null
    while ((m = regex.exec(raw)) !== null) {
      const text = m[2].trim()
      if (text) choices.push(text)
    }

    // Fallback 1: "1." numbered lines
    if (choices.length === 0) {
      choices = raw
        .split('\n')
        .filter(l => /^\d+[\.\)]\s+/.test(l.trim()))
        .map(l => l.replace(/^\d+[\.\)]\s+/, '').trim())
        .filter(Boolean)
    }

    // Fallback 2: paragraph blocks
    if (choices.length === 0) {
      choices = raw
        .split(/\n{2,}/)
        .map(s => s.trim())
        .filter(Boolean)
    }

    choices = choices.slice(0, count)

    // ── 4. Suspend execution and wait for user pick ───────────────────────────
    // Reset any previous selection
    useCanvasStore.getState().updateNodeData(node.id, { selectedChoice: null })

    // Set 'waiting' status with choices so the body renders them
    useCanvasStore.getState().setNodeOutput(node.id, {
      status: 'waiting',
      content: '',
      choices,
    })

    // Await user input — the execution loop is suspended here
    const selected = await waitForSelection(node.id)

    // Return selected text as this node's output
    return selected
  },
})
