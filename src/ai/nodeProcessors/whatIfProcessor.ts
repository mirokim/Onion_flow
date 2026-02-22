/**
 * What-If Branch Processor
 * Generates 2 alternate story developments from current scene.
 */
import { callWithTools, type ProviderResponse } from '../providers'
import { useAIStore } from '@/stores/aiStore'
import type { AIProvider } from '@/types'

export interface WhatIfResult {
  branchA: string
  branchB: string
}

export async function processWhatIf(
  currentScene: string,
  context: string,
): Promise<WhatIfResult> {
  const aiStore = useAIStore.getState()
  const provider = aiStore.activeProviders[0] as AIProvider | undefined
  if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')

  const config = aiStore.configs[provider]
  const messages = [
    {
      role: 'system',
      content: `당신은 소설 분기점 생성기입니다. 현재 씬에서 두 가지 다른 전개를 제안해야 합니다.
각 분기는 500자 내외로 작성하고, 서로 확연히 다른 방향이어야 합니다.
반드시 JSON 형태로 응답: {"branchA": "...", "branchB": "..."}`,
    },
    {
      role: 'user',
      content: `${context ? `[이전 맥락]\n${context}\n\n` : ''}[현재 씬]\n${currentScene}\n\n위 씬에서 분기되는 두 가지 다른 전개를 작성해 주세요.`,
    },
  ]

  const response: ProviderResponse = await callWithTools(config, messages, false)
  try {
    const parsed = JSON.parse(response.content)
    return { branchA: parsed.branchA || '', branchB: parsed.branchB || '' }
  } catch {
    // Fallback: split response in half
    const mid = Math.floor(response.content.length / 2)
    return { branchA: response.content.slice(0, mid), branchB: response.content.slice(mid) }
  }
}
