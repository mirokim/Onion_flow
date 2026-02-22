import type { CanvasNodeType, CanvasNodeCategory } from '@/types'

export interface HandleDefinition {
  id: string
  label: string
  type: 'source' | 'target'
  position: 'left' | 'right' | 'top' | 'bottom'
}

export interface NodeTypeDefinition {
  type: CanvasNodeType
  label: string
  labelKo: string
  category: CanvasNodeCategory
  color: string
  inputs: HandleDefinition[]
  outputs: HandleDefinition[]
  defaultData: Record<string, any>
}

export const NODE_CATEGORY_COLORS: Record<CanvasNodeCategory, string> = {
  context: '#4a90d9',
  direction: '#e6a23c',
  processing: '#67c23a',
  special: '#f56c6c',
  detector: '#909399',
  structure: '#8b5cf6',
  output: '#e040fb',
}

export const NODE_REGISTRY: NodeTypeDefinition[] = [
  // ── Context Nodes ──
  {
    type: 'personality',
    label: 'Personality',
    labelKo: '성격',
    category: 'context',
    color: NODE_CATEGORY_COLORS.context,
    inputs: [],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right' }],
    defaultData: { text: '', label: '성격' },
  },
  {
    type: 'appearance',
    label: 'Appearance',
    labelKo: '외모',
    category: 'context',
    color: NODE_CATEGORY_COLORS.context,
    inputs: [],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right' }],
    defaultData: { text: '', label: '외모' },
  },
  {
    type: 'memory',
    label: 'Memory',
    labelKo: '기억',
    category: 'context',
    color: NODE_CATEGORY_COLORS.context,
    inputs: [],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right' }],
    defaultData: { text: '', label: '기억' },
  },
  {
    type: 'character',
    label: 'Character',
    labelKo: '캐릭터',
    category: 'context',
    color: NODE_CATEGORY_COLORS.context,
    inputs: [
      { id: 'personality', label: '성격', type: 'target', position: 'left' },
      { id: 'appearance', label: '외모', type: 'target', position: 'left' },
      { id: 'memory', label: '기억', type: 'target', position: 'left' },
    ],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right' }],
    defaultData: { characterId: null, label: 'Character' },
  },
  {
    type: 'event',
    label: 'Event/Environment',
    labelKo: '사건/환경',
    category: 'context',
    color: NODE_CATEGORY_COLORS.context,
    inputs: [],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right' }],
    defaultData: { description: '', label: 'Event' },
  },
  {
    type: 'wiki',
    label: 'Wiki Data',
    labelKo: '위키 데이터',
    category: 'context',
    color: NODE_CATEGORY_COLORS.context,
    inputs: [],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right' }],
    defaultData: { wikiEntryId: null, label: 'Wiki' },
  },

  // ── Direction Nodes ──
  {
    type: 'pov',
    label: 'POV Control',
    labelKo: '시점 제어',
    category: 'direction',
    color: NODE_CATEGORY_COLORS.direction,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right' }],
    defaultData: { povType: 'third_limited', characterId: null, label: 'POV' },
  },
  {
    type: 'pacing',
    label: 'Pacing',
    labelKo: '텐션/호흡',
    category: 'direction',
    color: NODE_CATEGORY_COLORS.direction,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right' }],
    defaultData: { tension: 5, speed: 'normal', label: 'Pacing' },
  },
  {
    type: 'style_transfer',
    label: 'Style Transfer',
    labelKo: '문체 학습',
    category: 'direction',
    color: NODE_CATEGORY_COLORS.direction,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right' }],
    defaultData: { sampleText: '', authorName: '', label: 'Style' },
  },

  // ── Processing Nodes ──
  {
    type: 'storyteller',
    label: 'AI Storyteller',
    labelKo: 'AI 스토리텔러',
    category: 'processing',
    color: NODE_CATEGORY_COLORS.processing,
    inputs: [
      { id: 'context', label: 'Context', type: 'target', position: 'left' },
      { id: 'direction', label: 'Direction', type: 'target', position: 'left' },
    ],
    outputs: [{ id: 'out', label: 'Text', type: 'source', position: 'right' }],
    defaultData: { prompt: '', label: 'Storyteller', provider: null },
  },
  {
    type: 'summarizer',
    label: 'Summarizer',
    labelKo: '스토리 축약',
    category: 'processing',
    color: NODE_CATEGORY_COLORS.processing,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Summary', type: 'source', position: 'right' }],
    defaultData: { maxTokens: 500, label: 'Summarizer' },
  },

  // ── Special Nodes ──
  {
    type: 'what_if',
    label: 'What-If Branch',
    labelKo: '평행우주 분기',
    category: 'special',
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'in', label: 'Scene', type: 'target', position: 'left' }],
    outputs: [
      { id: 'branch_a', label: 'Branch A', type: 'source', position: 'right' },
      { id: 'branch_b', label: 'Branch B', type: 'source', position: 'right' },
    ],
    defaultData: { label: 'What-If' },
  },
  {
    type: 'show_dont_tell',
    label: "Show Don't Tell",
    labelKo: '묘사 증폭',
    category: 'special',
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'in', label: 'Input', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Output', type: 'source', position: 'right' }],
    defaultData: { label: 'Show' },
  },
  {
    type: 'tikitaka',
    label: 'Tikitaka Dialogue',
    labelKo: '티키타카 대화',
    category: 'special',
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'characters', label: 'Characters', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Dialogue', type: 'source', position: 'right' }],
    defaultData: { turns: 10, label: 'Tikitaka' },
  },
  {
    type: 'cliffhanger',
    label: 'Cliffhanger',
    labelKo: '절단신공',
    category: 'special',
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'in', label: 'Scene', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Endings', type: 'source', position: 'right' }],
    defaultData: { count: 3, label: 'Cliffhanger' },
  },
  {
    type: 'virtual_reader',
    label: 'Virtual Reader',
    labelKo: '가상 독자',
    category: 'special',
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'in', label: 'Manuscript', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Feedback', type: 'source', position: 'right' }],
    defaultData: { personas: ['사이다패스', '설정덕후', '감성독자'], label: 'Reader' },
  },

  // ── Output Nodes ──
  {
    type: 'save_story',
    label: 'Save Story',
    labelKo: '스토리 저장',
    category: 'output',
    color: NODE_CATEGORY_COLORS.output,
    inputs: [{ id: 'story', label: 'Story', type: 'target', position: 'left' }],
    outputs: [],
    defaultData: { filename: 'story.md', label: 'Save Story' },
  },

  // ── Structure Nodes ──
  {
    type: 'group',
    label: 'Group',
    labelKo: '그룹',
    category: 'structure',
    color: NODE_CATEGORY_COLORS.structure,
    inputs: [],
    outputs: [],
    defaultData: { label: 'Group' },
  },

  // ── Detector Nodes ──
  {
    type: 'emotion_tracker',
    label: 'Emotion Tracker',
    labelKo: '감정 트래커',
    category: 'detector',
    color: NODE_CATEGORY_COLORS.detector,
    inputs: [{ id: 'in', label: 'Text', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Emotions', type: 'source', position: 'right' }],
    defaultData: { label: 'Emotion' },
  },
  {
    type: 'foreshadow_detector',
    label: 'Foreshadow Detector',
    labelKo: '복선 디텍터',
    category: 'detector',
    color: NODE_CATEGORY_COLORS.detector,
    inputs: [{ id: 'in', label: 'Text', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Foreshadows', type: 'source', position: 'right' }],
    defaultData: { label: 'Foreshadow' },
  },
  {
    type: 'conflict_defense',
    label: 'Conflict Defense',
    labelKo: '설정 충돌 방어',
    category: 'detector',
    color: NODE_CATEGORY_COLORS.detector,
    inputs: [{ id: 'in', label: 'Text', type: 'target', position: 'left' }],
    outputs: [{ id: 'out', label: 'Warnings', type: 'source', position: 'right' }],
    defaultData: { label: 'Conflict' },
  },
]

export function getNodeDefinition(type: CanvasNodeType): NodeTypeDefinition | undefined {
  return NODE_REGISTRY.find(n => n.type === type)
}

export function getNodesByCategory(category: CanvasNodeCategory): NodeTypeDefinition[] {
  return NODE_REGISTRY.filter(n => n.category === category)
}
