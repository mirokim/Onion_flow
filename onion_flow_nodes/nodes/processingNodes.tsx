/**
 * Processing node plugins: storyteller, summarizer, switch, smart_switch
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import { SwitchNodeBody } from '../_base/SwitchNodeBody'
import { NodeTextarea } from '../_base/NodeTextarea'
import type { NodeBodyProps } from '../plugin'
import type { CanvasNode } from '@/types'
import { useCanvasStore } from '@/stores/canvasStore'
import { useAIStore } from '@/stores/aiStore'
import { cn } from '@/lib/utils'
import { runStoryteller } from '@/ai/storytellerEngine'

// ── storyteller ───────────────────────────────────────────────────────────────

function StorytellerNodeBody({ nodeId, data }: NodeBodyProps) {
  return (
    <div className="mt-1.5 space-y-1">
      <select
        value={data.provider || ''}
        onChange={(e) => {
          e.stopPropagation()
          useCanvasStore.getState().updateNodeData(nodeId, { provider: e.target.value || null })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
      >
        <option value="">기본 (글로벌 설정)</option>
        <option value="anthropic">Claude</option>
        <option value="gemini">Gemini</option>
        <option value="grok">Grok</option>
        <option value="openai">GPT</option>
      </select>
      <NodeTextarea
        nodeId={nodeId}
        field="prompt"
        value={data.prompt || ''}
        placeholder="추가 요구사항 입력..."
        rows={3}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-1 text-[10px] text-text-primary outline-none focus:border-accent resize-y min-h-[40px] max-h-[120px] leading-relaxed placeholder:text-text-muted/50"
      />
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'storyteller',
    label: 'AI Storyteller',
    labelKo: '✨ AI 스토리텔러',
    category: 'processing',
    tags: ['processing', 'ai'],
    color: NODE_CATEGORY_COLORS.processing,
    inputs: [
      { id: 'context', label: 'Context', type: 'target', position: 'left', acceptsTypes: ['CONTEXT', 'CHARACTER', 'TEXT'] },
      { id: 'plot', label: 'Plot', type: 'target', position: 'left', acceptsTypes: ['PLOT'] },
      { id: 'direction', label: 'Direction', type: 'target', position: 'left', acceptsTypes: ['DIRECTION'] },
    ],
    outputs: [{ id: 'out', label: 'Text', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { prompt: '', label: 'Storyteller', provider: null },
  },
  bodyComponent: StorytellerNodeBody,
  isExecutable: true,
  execute: async (node) => {
    return await runStoryteller(node.id)
  },
})

// ── summarizer ────────────────────────────────────────────────────────────────

function SummarizerNodeBody({ nodeId, data }: NodeBodyProps) {
  return (
    <div className="mt-1.5">
      <label className="block text-[9px] text-text-muted mb-0.5">
        최대 토큰: <span className="text-text-primary font-semibold">{data.maxTokens ?? 500}</span>
      </label>
      <input
        type="range" min={100} max={2000} step={100}
        value={data.maxTokens ?? 500}
        onChange={(e) => {
          e.stopPropagation()
          useCanvasStore.getState().updateNodeData(nodeId, { maxTokens: Number(e.target.value) })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="nodrag w-full h-1.5 accent-accent cursor-pointer"
      />
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'summarizer',
    label: 'Summarizer',
    labelKo: '✨ 스토리 축약',
    category: 'processing',
    tags: ['processing', 'ai'],
    color: NODE_CATEGORY_COLORS.processing,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [{ id: 'out', label: 'Summary', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { maxTokens: 500, label: 'Summarizer' },
  },
  bodyComponent: SummarizerNodeBody,
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    if (!context) return '요약할 컨텍스트가 없습니다.'
    const { callWithTools } = await import('@/ai/providers')
    const aiStore = useAIStore.getState()
    const provider = aiStore.activeProviders[0]
    if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')
    const config = aiStore.configs[provider]
    const maxTokens = (node.data.maxTokens as number) || 500
    const messages = [
      { role: 'system', content: `당신은 소설 요약 전문가입니다. 주어진 텍스트를 핵심만 남겨 간결하게 요약하세요. 약 ${maxTokens}토큰 이내로 요약하세요.` },
      { role: 'user', content: `다음 내용을 요약해 주세요:\n\n${context}` },
    ]
    const resp = await callWithTools(config, messages, false)
    return resp.content
  },
})

// ── switch ────────────────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'switch',
    label: 'Switch',
    labelKo: '스위치',
    category: 'processing',
    tags: ['processing'],
    color: NODE_CATEGORY_COLORS.processing,
    inputs: [
      { id: 'in_1', label: '① 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
      { id: 'in_2', label: '② 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
      { id: 'in_3', label: '③ 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
      { id: 'in_4', label: '④ 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
      { id: 'in_5', label: '⑤ 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
    ],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right', dataType: '*' }],
    defaultData: { selectedInput: 1, label: '스위치' },
  },
  bodyComponent: SwitchNodeBody,
  getAllowedInputHandles: (node) => {
    const selected = (node.data.selectedInput as number) || 1
    return new Set([`in_${selected}`])
  },
})

// ── smart_switch ──────────────────────────────────────────────────────────────

function SmartSwitchNodeBody({ nodeId, data }: NodeBodyProps) {
  return (
    <div className="mt-1.5 space-y-1.5">
      <div className="flex gap-0.5">
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            useCanvasStore.getState().updateNodeData(nodeId, { mode: 'sequential' })
          }}
          className={cn(
            'flex-1 text-[9px] py-0.5 rounded border transition-colors',
            (data.mode || 'sequential') === 'sequential'
              ? 'bg-accent text-white border-accent'
              : 'bg-bg-primary text-text-muted border-border hover:border-accent',
          )}
        >
          순서대로
        </button>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            useCanvasStore.getState().updateNodeData(nodeId, { mode: 'random' })
          }}
          className={cn(
            'flex-1 text-[9px] py-0.5 rounded border transition-colors',
            data.mode === 'random'
              ? 'bg-accent text-white border-accent'
              : 'bg-bg-primary text-text-muted border-border hover:border-accent',
          )}
        >
          랜덤
        </button>
      </div>
      <p className="text-[9px] text-text-muted text-center">
        현재: {['①', '②', '③', '④', '⑤'][(data.currentIndex as number) ?? 0] ?? '①'}
      </p>
    </div>
  )
}

function advanceSmartSwitchIndex(node: CanvasNode): void {
  const { wires, getCurrentParentCanvasId, updateNodeData } = useCanvasStore.getState()
  const parentId = getCurrentParentCanvasId()
  const connectedHandles = wires
    .filter(w => w.targetNodeId === node.id && w.parentCanvasId === parentId)
    .map(w => w.targetHandle)
    .filter((h): h is string => Boolean(h))
  if (connectedHandles.length === 0) return

  const mode = (node.data.mode as string) || 'sequential'
  const currentIndex = (node.data.currentIndex as number) ?? 0
  let newIndex: number
  if (mode === 'random') {
    newIndex = Math.floor(Math.random() * connectedHandles.length)
  } else {
    newIndex = (currentIndex + 1) % connectedHandles.length
  }
  updateNodeData(node.id, { currentIndex: newIndex })
}

registerPlugin({
  definition: {
    type: 'smart_switch',
    label: 'Smart Switch',
    labelKo: '스마트 스위치',
    category: 'processing',
    tags: ['processing'],
    color: NODE_CATEGORY_COLORS.processing,
    inputs: [
      { id: 'in_1', label: '① 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
      { id: 'in_2', label: '② 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
      { id: 'in_3', label: '③ 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
      { id: 'in_4', label: '④ 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
      { id: 'in_5', label: '⑤ 입력', type: 'target', position: 'left', acceptsTypes: ['*'] },
    ],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right', dataType: '*' }],
    defaultData: { mode: 'sequential', currentIndex: 0, label: '스마트 스위치' },
  },
  bodyComponent: SmartSwitchNodeBody,
  isExecutable: true,
  getAllowedInputHandles: (node) => {
    const { wires, getCurrentParentCanvasId } = useCanvasStore.getState()
    const parentId = getCurrentParentCanvasId()
    const connectedHandles = wires
      .filter(w => w.targetNodeId === node.id && w.parentCanvasId === parentId)
      .map(w => w.targetHandle)
      .filter((h): h is string => Boolean(h))
    if (connectedHandles.length === 0) return null
    const currentIndex = (node.data.currentIndex as number) ?? 0
    const selectedHandle = connectedHandles[currentIndex % connectedHandles.length]
    return selectedHandle ? new Set([selectedHandle]) : null
  },
  execute: async (node, collectContext) => {
    // Advance the index BEFORE collecting upstream context
    // (collectContext reads updated store state so new index is picked up automatically)
    advanceSmartSwitchIndex(node)
    const context = collectContext(node.id)
    return context || ''
  },
})
