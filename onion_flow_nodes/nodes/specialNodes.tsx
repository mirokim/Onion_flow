/**
 * Special node plugins: virtual_reader, preview_changed
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import { VirtualReaderNodeBody } from '../_base/VirtualReaderNodeBody'
import { useAIStore } from '@/stores/aiStore'
import { processVirtualReader } from '@/ai/nodeProcessors/virtualReaderProcessor'

// ── virtual_reader ────────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'virtual_reader',
    label: 'Virtual Reader',
    labelKo: '✨ 가상 독자',
    category: 'special',
    tags: ['special', 'ai'],
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'in', label: 'Manuscript', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [{ id: 'out', label: 'Feedback', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { personas: ['사이다패스', '설정덕후', '감성독자'], label: 'Reader' },
  },
  bodyComponent: VirtualReaderNodeBody,
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    const content = node.data.content || context || ''
    if (!content) return '분석할 콘텐츠가 없습니다.'
    const personas = node.data.selectedPersonas as string[] | undefined
    const comments = await processVirtualReader(content, personas)
    return comments.map((c: any) => `**${c.persona}** (${c.rating}/10)\n${c.comment}`).join('\n\n')
  },
})

// ── preview_changed ───────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'preview_changed',
    label: 'Preview Changed',
    labelKo: '✨ 변화 미리보기',
    category: 'special',
    tags: ['special', 'ai', 'character'],
    color: NODE_CATEGORY_COLORS.special,
    inputs: [{ id: 'character_in', label: '캐릭터', type: 'target', position: 'left', acceptsTypes: ['CHARACTER', 'CONTEXT'] }],
    outputs: [{ id: 'out', label: 'Preview', type: 'source', position: 'right', dataType: 'TEXT' }],
    defaultData: { label: '변화 미리보기' },
  },
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    if (!context) return '분석할 캐릭터 데이터가 없습니다.'
    const { callWithTools } = await import('@/ai/providers')
    const aiStore = useAIStore.getState()
    const provider = aiStore.activeProviders[0]
    if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')
    const config = aiStore.configs[provider]
    const messages = [
      {
        role: 'system',
        content: '당신은 소설 캐릭터 분석 전문가입니다. 캐릭터의 동기, 기억, 플롯 맥락을 바탕으로 캐릭터가 어떻게 변화할지 분석하고 미리보기를 제공합니다.',
      },
      {
        role: 'user',
        content: `다음 캐릭터 정보와 동기/기억/플롯 컨텍스트를 바탕으로, 이 캐릭터가 어떻게 변화할지 분석해 주세요.\n\n## 캐릭터 및 컨텍스트\n${context}\n\n## 분석 요청\n1. **행동 변화**: 동기와 기억에 따라 캐릭터의 행동이 어떻게 바뀔 수 있는지\n2. **심리 변화**: 내면의 갈등이나 성장 방향\n3. **관계 변화**: 다른 캐릭터와의 관계에 미치는 영향\n4. **서사적 전환점**: 플롯 진행에 따른 캐릭터 아크의 변화 포인트`,
      },
    ]
    const resp = await callWithTools(config, messages, false)
    return resp.content
  },
})
