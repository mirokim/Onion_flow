/**
 * Creative/special node plugins: what_if, show_dont_tell, tikitaka, cliffhanger
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import { NodeTextarea } from '../_base/NodeTextarea'
import type { NodeBodyProps } from '../plugin'
import { useCanvasStore } from '@/stores/canvasStore'
import { useAIStore } from '@/stores/aiStore'
import { useWikiStore } from '@/stores/wikiStore'
import { processWhatIf } from '@/ai/nodeProcessors/whatIfProcessor'
import { processShowDontTell } from '@/ai/nodeProcessors/showDontTellProcessor'
import { processCliffhanger } from '@/ai/nodeProcessors/cliffhangerProcessor'

// ── what_if ───────────────────────────────────────────────────────────────────

function WhatIfNodeBody({ nodeId, data }: NodeBodyProps) {
  return (
    <div className="mt-1.5">
      <label className="block text-[9px] text-text-muted mb-0.5">분기 장면 (선택)</label>
      <NodeTextarea
        nodeId={nodeId}
        field="scene"
        value={data.scene || ''}
        placeholder="비워두면 입력 데이터를 사용합니다..."
        rows={2}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-1 text-[10px] text-text-primary outline-none focus:border-accent resize-y min-h-[30px] max-h-[80px] leading-relaxed placeholder:text-text-muted/50"
      />
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'what_if',
    label: 'What-If Branch',
    labelKo: '✨ 평행우주 분기',
    category: 'special',
    tags: ['special', 'ai'],
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'in', label: 'Scene', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [
      { id: 'branch_a', label: 'Branch A', type: 'source', position: 'right', dataType: 'TEXT' },
      { id: 'branch_b', label: 'Branch B', type: 'source', position: 'right', dataType: 'TEXT' },
    ],
    defaultData: { label: 'What-If' },
  },
  bodyComponent: WhatIfNodeBody,
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    const currentScene = node.data.scene || context || ''
    const result = await processWhatIf(currentScene, context)
    return `## 분기 A\n${result.branchA}\n\n## 분기 B\n${result.branchB}`
  },
})

// ── show_dont_tell ────────────────────────────────────────────────────────────

function ShowDontTellNodeBody({ nodeId, data }: NodeBodyProps) {
  return (
    <div className="mt-1.5">
      <label className="block text-[9px] text-text-muted mb-0.5">변환할 텍스트 (선택)</label>
      <NodeTextarea
        nodeId={nodeId}
        field="inputText"
        value={data.inputText || ''}
        placeholder="비워두면 입력 데이터를 사용합니다..."
        rows={2}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-1 text-[10px] text-text-primary outline-none focus:border-accent resize-y min-h-[30px] max-h-[80px] leading-relaxed placeholder:text-text-muted/50"
      />
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'show_dont_tell',
    label: "Show Don't Tell",
    labelKo: '✨ 묘사 증폭',
    category: 'special',
    tags: ['special', 'ai'],
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { label: 'Show' },
  },
  bodyComponent: ShowDontTellNodeBody,
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    const inputText = node.data.inputText || context || ''
    if (!inputText) return '변환할 텍스트가 없습니다.'
    return await processShowDontTell(inputText)
  },
})

// ── tikitaka ──────────────────────────────────────────────────────────────────

function TikitakaNodeBody({ nodeId, data }: NodeBodyProps) {
  return (
    <div className="mt-1.5 space-y-1.5">
      <div>
        <label className="block text-[9px] text-text-muted mb-0.5">대화 주제</label>
        <NodeTextarea
          nodeId={nodeId}
          field="topic"
          value={data.topic || ''}
          placeholder="캐릭터들이 대화할 주제..."
          rows={2}
          className="w-full bg-bg-primary border border-border rounded px-1.5 py-1 text-[10px] text-text-primary outline-none focus:border-accent resize-y min-h-[30px] max-h-[80px] leading-relaxed placeholder:text-text-muted/50"
        />
      </div>
      <div>
        <label className="block text-[9px] text-text-muted mb-0.5">
          대화 턴 수: <span className="text-text-primary font-semibold">{data.turns ?? 10}</span>
        </label>
        <input
          type="range" min={2} max={30} step={1}
          value={data.turns ?? 10}
          onChange={(e) => {
            e.stopPropagation()
            useCanvasStore.getState().updateNodeData(nodeId, { turns: Number(e.target.value) })
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="nodrag w-full h-1.5 accent-accent cursor-pointer"
        />
      </div>
      <p className="text-[9px] text-text-muted/60">
        캐릭터 노드를 연결하면 자동으로 캐릭터가 추가됩니다
      </p>
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'tikitaka',
    label: 'Tikitaka Dialogue',
    labelKo: '✨ 티키타카 대화',
    category: 'special',
    tags: ['special', 'ai', 'character'],
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'characters', label: 'Characters', type: 'target', position: 'left', acceptsTypes: ['CHARACTER', 'CONTEXT'] }],
    outputs: [{ id: 'out', label: 'Dialogue', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { turns: 10, label: 'Tikitaka' },
  },
  bodyComponent: TikitakaNodeBody,
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    const topic = (node.data.topic || '') as string
    const turns = (node.data.turns as number) || 10
    const { nodes: allNodes, wires: allWires } = useCanvasStore.getState()
    const wikiEntries = useWikiStore.getState().entries
    const upstreamCharacters: Array<{ name: string; content: string }> = []
    const incoming = allWires.filter(w => w.targetNodeId === node.id)
    for (const wire of incoming) {
      const srcNode = allNodes.find(n => n.id === wire.sourceNodeId)
      if (srcNode?.type === 'character' && srcNode.data.wikiEntryId) {
        const entry = wikiEntries.find(e => e.id === srcNode.data.wikiEntryId)
        if (entry) upstreamCharacters.push({ name: entry.title, content: entry.content || '' })
      }
    }
    if (upstreamCharacters.length < 2) return '최소 2명의 캐릭터 노드를 연결해 주세요.'

    const { callWithTools } = await import('@/ai/providers')
    const aiStore = useAIStore.getState()
    const provider = aiStore.activeProviders[0]
    if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')
    const config = aiStore.configs[provider]
    const charDescriptions = upstreamCharacters.map(c => `- ${c.name}: ${c.content.slice(0, 200)}`).join('\n')
    const messages = [
      {
        role: 'system',
        content: `당신은 대화 전문 작가입니다. 지문 없이 캐릭터 간 대화만 생성합니다.\n각 캐릭터의 말투와 성격을 정확히 반영해야 합니다.\n형식: "캐릭터명: 대사" (한 줄에 하나씩)\n약 ${turns}턴 분량으로 생성하세요.\n\n[참여 캐릭터]\n${charDescriptions}`,
      },
      {
        role: 'user',
        content: `${context ? `[상황]\n${context}\n\n` : ''}${topic ? `[대화 주제]\n${topic}\n\n` : ''}위 캐릭터들의 대화를 자연스럽게 생성해 주세요.`,
      },
    ]
    const resp = await callWithTools(config, messages, false)
    return resp.content
  },
})

// ── cliffhanger ───────────────────────────────────────────────────────────────

function CliffhangerNodeBody({ nodeId, data }: NodeBodyProps) {
  return (
    <div className="mt-1.5">
      <label className="block text-[9px] text-text-muted mb-0.5">
        제안 수: <span className="text-text-primary font-semibold">{data.count ?? 3}</span>
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
  )
}

registerPlugin({
  definition: {
    type: 'cliffhanger',
    label: 'Cliffhanger',
    labelKo: '✨ 절단신공',
    category: 'special',
    tags: ['special', 'ai'],
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'in', label: 'Scene', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [{ id: 'out', label: 'Endings', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { count: 3, label: 'Cliffhanger' },
  },
  bodyComponent: CliffhangerNodeBody,
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    const chapterContent = node.data.chapterContent || context || ''
    if (!chapterContent) return '분석할 챕터 내용이 없습니다.'
    const count = (node.data.count as number) || 3
    const suggestions = await processCliffhanger(chapterContent)
    return suggestions.slice(0, count).map((s: any, i: number) => `${i + 1}. [${s.type}] ${s.text}`).join('\n\n')
  },
})
