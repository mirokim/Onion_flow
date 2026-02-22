/**
 * Tikitaka Dialogue Processor
 * Generates character-to-character dialogue without narration.
 */
import { callWithTools, type ProviderResponse } from '../providers'
import { useAIStore } from '@/stores/aiStore'
import { useWorldStore } from '@/stores/worldStore'
import type { AIProvider, Character } from '@/types'

export async function processTikitaka(
  characterIds: string[],
  topic: string,
  context: string,
): Promise<string> {
  const aiStore = useAIStore.getState()
  const provider = aiStore.activeProviders[0] as AIProvider | undefined
  if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')

  const characters = useWorldStore.getState().characters
  const selectedChars = characterIds
    .map(id => characters.find(c => c.id === id))
    .filter((c): c is Character => !!c)

  if (selectedChars.length < 2) throw new Error('최소 2명의 캐릭터가 필요합니다.')

  const charDescriptions = selectedChars.map(c =>
    `- ${c.name}: 성격(${c.personality || '미설정'}), 말투(${c.speechPattern || '미설정'})`
  ).join('\n')

  const config = aiStore.configs[provider]
  const messages = [
    {
      role: 'system',
      content: `당신은 대화 전문 작가입니다. 지문 없이 캐릭터 간 대화만 생성합니다.
각 캐릭터의 말투와 성격을 정확히 반영해야 합니다.
형식: "캐릭터명: 대사" (한 줄에 하나씩)

[참여 캐릭터]
${charDescriptions}`,
    },
    {
      role: 'user',
      content: `${context ? `[상황]\n${context}\n\n` : ''}[대화 주제]\n${topic}\n\n위 캐릭터들의 대화를 자연스럽게 생성해 주세요.`,
    },
  ]

  const response: ProviderResponse = await callWithTools(config, messages, false)
  return response.content
}
