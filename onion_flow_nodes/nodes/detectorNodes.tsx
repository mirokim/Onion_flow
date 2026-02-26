/**
 * Detector node plugins: emotion_tracker, foreshadow_detector, conflict_defense
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import { useAIStore } from '@/stores/aiStore'

const DETECTOR_PROMPTS: Record<string, string> = {
  emotion_tracker: '다음 텍스트에서 각 캐릭터의 감정 변화를 추적하고 분석해 주세요.',
  foreshadow_detector: '다음 텍스트에서 복선(foreshadowing) 요소를 찾아 분석해 주세요.',
  conflict_defense: '다음 텍스트에서 갈등 구조를 분석하고, 서사적 방어 메커니즘을 점검해 주세요.',
}

async function executeDetector(nodeType: string, collectContext: (id: string) => string, nodeId: string): Promise<string> {
  const context = collectContext(nodeId)
  if (!context) return '분석할 데이터가 없습니다.'
  const { callWithTools } = await import('@/ai/providers')
  const aiStore = useAIStore.getState()
  const provider = aiStore.activeProviders[0]
  if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')
  const config = aiStore.configs[provider]
  const messages = [
    { role: 'system', content: `당신은 소설 분석 전문가입니다. ${DETECTOR_PROMPTS[nodeType]}` },
    { role: 'user', content: context },
  ]
  const resp = await callWithTools(config, messages, false)
  return resp.content
}

// ── emotion_tracker ───────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'emotion_tracker',
    label: 'Emotion Tracker',
    labelKo: '✨ 감정 트래커',
    category: 'detector',
    tags: ['detector', 'ai'],
    color: NODE_CATEGORY_COLORS.detector,
    inputs: [{ id: 'in', label: 'Text', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [{ id: 'out', label: 'Emotions', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { label: 'Emotion' },
  },
  isExecutable: true,
  execute: (node, collectContext) => executeDetector(node.type, collectContext, node.id),
})

// ── foreshadow_detector ───────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'foreshadow_detector',
    label: 'Foreshadow Detector',
    labelKo: '✨ 복선 디텍터',
    category: 'detector',
    tags: ['detector', 'ai'],
    color: NODE_CATEGORY_COLORS.detector,
    inputs: [{ id: 'in', label: 'Text', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [{ id: 'out', label: 'Foreshadows', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { label: 'Foreshadow' },
  },
  isExecutable: true,
  execute: (node, collectContext) => executeDetector(node.type, collectContext, node.id),
})

// ── conflict_defense ──────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'conflict_defense',
    label: 'Conflict Defense',
    labelKo: '✨ 설정 충돌 방어',
    category: 'detector',
    tags: ['detector', 'ai'],
    color: NODE_CATEGORY_COLORS.detector,
    inputs: [{ id: 'in', label: 'Text', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [{ id: 'out', label: 'Warnings', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { label: 'Conflict' },
  },
  isExecutable: true,
  execute: (node, collectContext) => executeDetector(node.type, collectContext, node.id),
})
