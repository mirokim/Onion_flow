/**
 * Show, Don't Tell Processor
 * Transforms simple descriptions into sensory-rich prose.
 */
import { callWithTools, type ProviderResponse } from '../providers'
import { useAIStore } from '@/stores/aiStore'
import type { AIProvider } from '@/types'

export async function processShowDontTell(
  inputText: string,
): Promise<string> {
  const aiStore = useAIStore.getState()
  const provider = aiStore.activeProviders[0] as AIProvider | undefined
  if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')

  const config = aiStore.configs[provider]
  const messages = [
    {
      role: 'system',
      content: `당신은 묘사 증폭 전문가입니다. 단순한 설명을 오감(시각, 청각, 촉각, 후각, 미각)을 활용한 생생한 묘사로 변환합니다.
규칙:
- "슬펐다" → 구체적 행동/감각으로 표현
- 감정을 직접 서술하지 말고 행동과 환경으로 간접 전달
- 입력 텍스트의 핵심 의미를 유지하되 훨씬 풍부하게 확장
- 결과만 반환 (설명이나 메타 코멘트 없이)`,
    },
    {
      role: 'user',
      content: inputText,
    },
  ]

  const response: ProviderResponse = await callWithTools(config, messages, false)
  return response.content
}
