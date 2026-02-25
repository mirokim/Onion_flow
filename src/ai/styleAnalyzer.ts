/**
 * styleAnalyzer.ts
 * 3가지 소스(위키 / URL / txt 문서)에서 글을 가져와 AI로 문체를 분석한다.
 * 결과를 마크다운 형식의 문자열로 반환한다.
 */

import { useWikiStore } from '@/stores/wikiStore'
import { useAIStore } from '@/stores/aiStore'
import { callWithTools } from '@/ai/providers'

// ── 공통: AI 문체 분석 프롬프트 ─────────────────────────────────────────

async function _analyzeStyle(sourceText: string): Promise<string> {
  const aiStore = useAIStore.getState()
  const provider = aiStore.activeProviders[0]
  if (!provider) throw new Error('활성화된 AI 제공자가 없습니다. AI 설정을 확인해주세요.')
  const config = aiStore.configs[provider]
  if (!config?.enabled) throw new Error('AI가 비활성화 상태입니다. 설정에서 API 키를 확인해주세요.')

  const prompt = `당신은 문학 편집자입니다. 아래 글에서 작가의 문체를 분석하여 정확히 다음 마크다운 형식으로 리포트를 작성해주세요. 다른 설명 없이 마크다운만 출력하세요.

[분석할 글]
${sourceText.slice(0, 6000)}

[출력 형식]
# 내 문체 분석

## 문장 스타일
- 평균 문장 길이: (짧음/중간/김, 예시 포함)
- 단락 구성: (특징 설명)

## 어조 & 시점
- 어조: (예: 서정적, 건조한, 역동적 등)
- 주로 쓰는 시점: (1인칭/2인칭/3인칭 제한/전지전능)

## 묘사 방식
- 감각적 묘사 빈도: (높음/중간/낮음, 특징)
- 심리 묘사 비중: (높음/중간/낮음, 특징)

## 대화 스타일
- 대화 빈도 및 특징: (설명)

## 특징적 표현 패턴
- (작가만의 반복되는 패턴이나 습관 3~5가지)

## AI 스타일 지시문
이 작가의 문체를 따르려면: (AI가 글을 쓸 때 직접 참고할 수 있는 구체적인 지시문 형태로 작성)`

  const messages = [{ role: 'user' as const, content: prompt }]
  const resp = await callWithTools(config, messages, false)
  const result = resp.content?.trim()
  if (!result) throw new Error('AI 응답이 비어 있습니다.')
  return result
}

// ── 위키에서 분석 ───────────────────────────────────────────────────────

export async function analyzeStyleFromWiki(projectId: string): Promise<string> {
  const entries = useWikiStore.getState().entries.filter(
    e => e.projectId === projectId && e.content.trim()
  )
  if (entries.length === 0)
    throw new Error('분석할 위키 항목이 없습니다. 위키에 내용을 먼저 작성해주세요.')

  const sourceText = entries
    .map(e => `[${e.category} / ${e.title}]\n${e.content}`)
    .join('\n\n')

  return _analyzeStyle(sourceText)
}

// ── URL에서 분석 ────────────────────────────────────────────────────────

export async function analyzeStyleFromUrl(url: string): Promise<string> {
  if (!url.startsWith('http')) throw new Error('올바른 URL을 입력해주세요.')

  const api = (window as any).electronAPI
  if (!api?.fetchUrl) throw new Error('URL 가져오기가 지원되지 않는 환경입니다.')

  const result = await api.fetchUrl(url)
  if (!result.success) throw new Error(`URL 가져오기 실패: ${result.error}`)

  // HTML 태그 및 스크립트 제거 후 순수 텍스트 추출
  const text = result.data
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) throw new Error('URL에서 텍스트를 추출할 수 없습니다.')
  return _analyzeStyle(text)
}

// ── txt 문서에서 분석 ───────────────────────────────────────────────────

export async function analyzeStyleFromText(rawText: string): Promise<string> {
  if (!rawText.trim()) throw new Error('분석할 텍스트가 없습니다.')
  return _analyzeStyle(rawText)
}
