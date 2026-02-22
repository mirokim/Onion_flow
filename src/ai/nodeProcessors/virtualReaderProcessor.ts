/**
 * Virtual Reader Simulator
 * Generates fictional reader comments based on different personas.
 */
import { callWithTools, type ProviderResponse } from '../providers'
import { useAIStore } from '@/stores/aiStore'
import type { AIProvider } from '@/types'

export interface VirtualReaderComment {
  persona: string
  comment: string
  rating: number
}

const READER_PERSONAS = [
  { id: 'cider', name: '사이다 패스', desc: '빠른 진행과 통쾌한 전개를 선호하는 독자' },
  { id: 'lore', name: '설정 덕후', desc: '세계관과 설정의 디테일에 집중하는 독자' },
  { id: 'emotional', name: '감성 독자', desc: '캐릭터 감정과 관계에 몰입하는 독자' },
  { id: 'critic', name: '까리한 독자', desc: '문장력과 구성의 완성도를 중시하는 독자' },
  { id: 'casual', name: '가벼운 독자', desc: '재미 위주로 가볍게 읽는 독자' },
]

export async function processVirtualReader(
  content: string,
  selectedPersonas?: string[],
): Promise<VirtualReaderComment[]> {
  const aiStore = useAIStore.getState()
  const provider = aiStore.activeProviders[0] as AIProvider | undefined
  if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')

  const personas = selectedPersonas
    ? READER_PERSONAS.filter(p => selectedPersonas.includes(p.id))
    : READER_PERSONAS

  const personaDesc = personas.map(p => `- ${p.name}: ${p.desc}`).join('\n')

  const config = aiStore.configs[provider]
  const messages = [
    {
      role: 'system',
      content: `당신은 가상 독자 시뮬레이터입니다. 각 페르소나의 관점에서 솔직한 독자 반응을 생성합니다.
각 반응에 1~10점 평가를 포함하세요.

[페르소나]
${personaDesc}

JSON 배열로 응답: [{"persona": "사이다 패스", "comment": "...", "rating": 8}, ...]`,
    },
    {
      role: 'user',
      content: `[원고]\n${content.slice(0, 3000)}\n\n위 원고에 대한 가상 독자 반응을 생성해 주세요.`,
    },
  ]

  const response: ProviderResponse = await callWithTools(config, messages, false)
  try {
    return JSON.parse(response.content) as VirtualReaderComment[]
  } catch {
    return [{ persona: '가상 독자', comment: response.content, rating: 7 }]
  }
}

export { READER_PERSONAS }
