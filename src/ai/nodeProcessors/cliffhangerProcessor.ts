/**
 * Cliffhanger Processor
 * Generates 3-5 tension-maximizing chapter ending suggestions.
 */
import { callWithTools, type ProviderResponse } from '../providers'
import { useAIStore } from '@/stores/aiStore'
import type { AIProvider } from '@/types'

export interface CliffhangerSuggestion {
  text: string
  type: string
}

export async function processCliffhanger(
  chapterContent: string,
): Promise<CliffhangerSuggestion[]> {
  const aiStore = useAIStore.getState()
  const provider = aiStore.activeProviders[0] as AIProvider | undefined
  if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')

  const config = aiStore.configs[provider]
  const messages = [
    {
      role: 'system',
      content: `당신은 절단신공(클리프행어) 전문가입니다. 챕터 엔딩의 긴장감을 극대화하는 문장을 제안합니다.
3~5개의 제안을 생성하세요. 각 제안은 다른 유형이어야 합니다:
- 반전형: 예상치 못한 반전
- 위기형: 위험한 상황 암시
- 의문형: 독자의 궁금증 유발
- 감정형: 강렬한 감정적 충격
- 암시형: 다음 사건 암시

JSON 배열로 응답: [{"text": "...", "type": "반전형"}, ...]`,
    },
    {
      role: 'user',
      content: `[챕터 내용 (마지막 부분)]\n${chapterContent.slice(-2000)}\n\n이 챕터의 절단신공 엔딩을 제안해 주세요.`,
    },
  ]

  const response: ProviderResponse = await callWithTools(config, messages, false)
  try {
    return JSON.parse(response.content) as CliffhangerSuggestion[]
  } catch {
    return [{ text: response.content, type: '자동' }]
  }
}
