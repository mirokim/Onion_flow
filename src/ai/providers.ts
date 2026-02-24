/**
 * Multi-provider AI API integration.
 * Ported from onion_editor - supports OpenAI, Anthropic, Gemini, Llama.
 */
import type { AIConfig, AIToolCall, AIAttachment } from '@/types'
import { toOpenAITools, toOpenAIToolsCompact, toAnthropicTools, toGeminiTools } from './tools'

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type AnthropicContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

type GeminiContentPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

type MultimodalContent = OpenAIContentPart[] | AnthropicContentPart[] | GeminiContentPart[]

interface OpenAIToolCallResponse {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

interface OpenAIChoice {
  message: { content: string | null; tool_calls?: OpenAIToolCallResponse[] }
  finish_reason: string
}

interface OpenAIResponse {
  choices: OpenAIChoice[]
  error?: { message: string }
}

interface AnthropicContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

interface AnthropicResponse {
  content: AnthropicContentBlock[]
  stop_reason: string
  error?: { message: string }
}

interface GeminiPart {
  text?: string
  functionCall?: { name: string; args: Record<string, unknown> }
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>
  error?: { message: string }
}

function buildMultimodalContent(
  text: string,
  attachments: AIAttachment[] | undefined,
  provider: 'openai' | 'anthropic' | 'gemini' | 'llama' | 'grok',
): string | MultimodalContent {
  if (!attachments || attachments.length === 0) return text

  if (provider === 'openai' || provider === 'llama' || provider === 'grok') {
    const parts: OpenAIContentPart[] = []
    for (const att of attachments) {
      if (att.type === 'image') {
        parts.push({ type: 'image_url', image_url: { url: `data:${att.mimeType};base64,${att.data}` } })
      } else {
        try {
          const decoded = atob(att.data)
          parts.push({ type: 'text', text: `[파일: ${att.name}]\n${decoded}` })
        } catch { parts.push({ type: 'text', text: `[파일: ${att.name} - 읽기 실패]` }) }
      }
    }
    parts.push({ type: 'text', text })
    return parts
  }
  if (provider === 'anthropic') {
    const parts: AnthropicContentPart[] = []
    for (const att of attachments) {
      if (att.type === 'image') {
        parts.push({ type: 'image', source: { type: 'base64', media_type: att.mimeType, data: att.data } })
      } else {
        try {
          const decoded = atob(att.data)
          parts.push({ type: 'text', text: `[파일: ${att.name}]\n${decoded}` })
        } catch { parts.push({ type: 'text', text: `[파일: ${att.name} - 읽기 실패]` }) }
      }
    }
    parts.push({ type: 'text', text })
    return parts
  }
  // Gemini
  const parts: GeminiContentPart[] = []
  for (const att of attachments) {
    if (att.type === 'image') {
      parts.push({ inlineData: { mimeType: att.mimeType, data: att.data } })
    } else {
      try {
        const decoded = atob(att.data)
        parts.push({ text: `[파일: ${att.name}]\n${decoded}` })
      } catch { parts.push({ text: `[파일: ${att.name} - 읽기 실패]` }) }
    }
  }
  parts.push({ text })
  return parts
}

export interface ProviderResponse {
  content: string
  toolCalls: AIToolCall[]
  stopReason: 'end' | 'tool_use'
}

type ApiMessage = { role: string; content: string | unknown[] | null; [key: string]: unknown }

export async function callWithTools(
  config: AIConfig,
  messages: ApiMessage[],
  useTools: boolean = true,
  attachments?: AIAttachment[],
  signal?: AbortSignal,
): Promise<ProviderResponse> {
  if (!config.apiKey && !config.baseUrl) throw new Error(`${config.provider} API key not set`)

  if (attachments && attachments.length > 0) {
    const lastIdx = messages.length - 1
    if (lastIdx >= 0 && messages[lastIdx].role === 'user') {
      const lastMsg = { ...messages[lastIdx] }
      const text = typeof lastMsg.content === 'string' ? lastMsg.content : String(lastMsg.content || '')
      lastMsg.content = buildMultimodalContent(text, attachments, config.provider)
      messages = [...messages.slice(0, lastIdx), lastMsg]
    }
  }

  if (config.provider === 'openai') return callOpenAI(config, messages, useTools, signal)
  if (config.provider === 'anthropic') return callAnthropic(config, messages, useTools, signal)
  if (config.provider === 'gemini') return callGemini(config, messages, useTools, signal)
  if (config.provider === 'llama') return callLlama(config, messages, useTools, signal)
  if (config.provider === 'grok') return callGrok(config, messages, useTools, signal)
  throw new Error('Unknown provider')
}

async function callOpenAI(config: AIConfig, messages: ApiMessage[], useTools: boolean, signal?: AbortSignal): Promise<ProviderResponse> {
  const body: Record<string, unknown> = { model: config.model, messages }
  if (useTools) body.tools = toOpenAITools()

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
    signal,
  })
  const data = await res.json() as OpenAIResponse
  if (data.error) throw new Error(data.error.message)

  const choice = data.choices[0]
  const msg = choice.message
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const toolCalls: AIToolCall[] = msg.tool_calls.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }))
    return { content: msg.content || '', toolCalls, stopReason: 'tool_use' }
  }
  return { content: msg.content || '', toolCalls: [], stopReason: 'end' }
}

async function callAnthropic(config: AIConfig, messages: ApiMessage[], useTools: boolean, signal?: AbortSignal): Promise<ProviderResponse> {
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs = messages.filter(m => m.role !== 'system')

  const mappedMsgs = chatMsgs.map(m => {
    const role = m.role === 'tool' ? 'user' : m.role
    const content = Array.isArray(m.content) ? m.content
      : typeof m.content === 'string' ? m.content
      : String(m.content || '')
    return { role, content }
  }).filter(m => {
    if (Array.isArray(m.content)) return m.content.length > 0
    if (typeof m.content === 'string') return m.content.trim().length > 0
    return m.content != null
  })

  const systemContent = typeof systemMsg?.content === 'string' ? systemMsg.content : ''
  const systemWithCache = systemContent.length > 200
    ? [{ type: 'text', text: systemContent, cache_control: { type: 'ephemeral' } }]
    : systemContent

  const body: Record<string, unknown> = {
    model: config.model,
    max_tokens: 8192,
    system: systemWithCache,
    messages: mappedMsgs,
  }
  if (useTools) body.tools = toAnthropicTools()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': config.apiKey,
    'anthropic-version': '2023-06-01',
  }
  const isElectron = typeof window !== 'undefined' && !!(window as unknown as { electronAPI?: { isElectron?: boolean } }).electronAPI?.isElectron
  if (!isElectron) {
    headers['anthropic-dangerous-direct-browser-access'] = 'true'
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers, body: JSON.stringify(body), signal,
  })
  const data = await res.json() as AnthropicResponse
  if (data.error) throw new Error(data.error.message)

  const textBlocks = data.content.filter((b): b is AnthropicContentBlock & { type: 'text'; text: string } => b.type === 'text')
  const toolBlocks = data.content.filter((b): b is AnthropicContentBlock & { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> } => b.type === 'tool_use')

  const content = textBlocks.map(b => b.text).join('\n')
  const toolCalls: AIToolCall[] = toolBlocks.map(b => ({
    id: b.id,
    name: b.name,
    arguments: b.input,
  }))

  return { content, toolCalls, stopReason: data.stop_reason === 'tool_use' ? 'tool_use' : 'end' }
}

function sanitizeGeminiContent(text: string, role: string): string {
  if (role !== 'assistant' && role !== 'model') return text
  return text
    .replace(/```(?:tool_outputs|json)?\s*[{[][\s\S]*?[}\]]\s*```/g, '')
    .replace(/\[도구 실행됨\]/g, '')
    .trim() || text
}

async function callGemini(config: AIConfig, messages: ApiMessage[], useTools: boolean, signal?: AbortSignal): Promise<ProviderResponse> {
  const systemMsg = messages.find(m => m.role === 'system')
  const chatMsgs = messages.filter(m => m.role !== 'system' && m.role !== 'tool')

  type GeminiMsgPart = { text?: string; [key: string]: unknown }
  const rawContents = chatMsgs.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: (Array.isArray(m.content) ? m.content
      : typeof m.content === 'string' ? [{ text: sanitizeGeminiContent(m.content, m.role) }]
      : [{ text: String(m.content || '') }]) as GeminiMsgPart[],
  })).filter(m => {
    if (!m.parts || m.parts.length === 0) return false
    if (m.parts.length === 1 && m.parts[0].text !== undefined && !m.parts[0].text.trim()) return false
    return true
  })

  const contents: typeof rawContents = []
  for (const msg of rawContents) {
    const prev = contents[contents.length - 1]
    if (prev && prev.role === msg.role) {
      prev.parts = [...prev.parts, ...msg.parts]
    } else {
      contents.push({ ...msg, parts: [...msg.parts] })
    }
  }

  const body: Record<string, unknown> = { contents }
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: typeof systemMsg.content === 'string' ? systemMsg.content : '' }] }
  }
  if (useTools) {
    body.tools = toGeminiTools()
    body.tool_config = { function_calling_config: { mode: 'ANY' } }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey },
      body: JSON.stringify(body),
      signal,
    },
  )
  const data = await res.json() as GeminiResponse
  if (data.error) throw new Error(data.error.message)

  const parts = data.candidates?.[0]?.content?.parts || []
  const textParts = parts.filter((p): p is GeminiPart & { text: string } => !!p.text)
  const functionParts = parts.filter((p): p is GeminiPart & { functionCall: { name: string; args: Record<string, unknown> } } => !!p.functionCall)

  const content = textParts.map(p => p.text).join('\n')
  const toolCalls: AIToolCall[] = functionParts.map((p, i) => ({
    id: `gemini-${Date.now()}-${i}`,
    name: p.functionCall.name,
    arguments: p.functionCall.args,
  }))

  return { content, toolCalls, stopReason: toolCalls.length > 0 ? 'tool_use' : 'end' }
}

async function callLlama(config: AIConfig, messages: ApiMessage[], useTools: boolean, signal?: AbortSignal): Promise<ProviderResponse> {
  const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'https://api.together.xyz/v1'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`

  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(baseUrl)
  const fetchUrl = isLocal && import.meta.env.DEV
    ? `/local-llm-proxy${new URL(`${baseUrl}/chat/completions`).pathname}` + `?__port=${new URL(baseUrl).port || '80'}`
    : `${baseUrl}/chat/completions`

  const doFetch = async (withTools: boolean): Promise<ProviderResponse> => {
    const body: Record<string, unknown> = { model: config.model, messages }
    if (withTools) body.tools = isLocal ? toOpenAIToolsCompact() : toOpenAITools()

    const res = await fetch(fetchUrl, { method: 'POST', headers, body: JSON.stringify(body), signal })
    const rawText = await res.text().catch(() => '')
    let data: OpenAIResponse & { error?: { message?: string } | string }
    try {
      data = JSON.parse(rawText)
    } catch {
      throw new Error(`서버 응답 파싱 실패 (HTTP ${res.status})`)
    }

    if (data.error) {
      const errMsg = typeof data.error === 'string' ? data.error : (data.error as { message?: string }).message || ''
      throw new Error(errMsg || `서버 오류 (HTTP ${res.status})`)
    }
    if (!data.choices?.length) throw new Error('모델 응답이 비어있습니다.')

    const choice = data.choices[0]
    const msg = choice.message
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      try {
        const toolCalls: AIToolCall[] = msg.tool_calls.map(tc => ({
          id: tc.id || `local-${Date.now()}`,
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function.arguments,
        }))
        return { content: msg.content || '', toolCalls, stopReason: 'tool_use' }
      } catch {
        return { content: msg.content || '', toolCalls: [], stopReason: 'end' }
      }
    }
    return { content: msg.content || '', toolCalls: [], stopReason: 'end' }
  }

  if (useTools) {
    try {
      return await doFetch(true)
    } catch (err: unknown) {
      const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
      const isToolError = msg.includes('tool') || msg.includes('function') || msg.includes('not supported') || msg.includes('unsupported')
      if (isToolError) return await doFetch(false)
      throw err
    }
  }
  return await doFetch(false)
}

async function callGrok(config: AIConfig, messages: ApiMessage[], useTools: boolean, signal?: AbortSignal): Promise<ProviderResponse> {
  const baseUrl = config.baseUrl?.replace(/\/+$/, '') || 'https://api.x.ai/v1'
  const body: Record<string, unknown> = { model: config.model, messages }
  if (useTools) body.tools = toOpenAITools()

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify(body),
    signal,
  })
  const data = await res.json() as OpenAIResponse
  if (data.error) throw new Error(data.error.message)

  const choice = data.choices[0]
  const msg = choice.message
  if (msg.tool_calls && msg.tool_calls.length > 0) {
    const toolCalls: AIToolCall[] = msg.tool_calls.map(tc => ({
      id: tc.id,
      name: tc.function.name,
      arguments: JSON.parse(tc.function.arguments),
    }))
    return { content: msg.content || '', toolCalls, stopReason: 'tool_use' }
  }
  return { content: msg.content || '', toolCalls: [], stopReason: 'end' }
}

export function buildToolResultMessages(
  provider: string,
  toolCalls: AIToolCall[],
  results: { toolCallId: string; result: string }[],
): ApiMessage[] {
  if (provider === 'openai' || provider === 'llama' || provider === 'grok') {
    return results.map(r => ({ role: 'tool', content: r.result, tool_call_id: r.toolCallId } as ApiMessage))
  }
  if (provider === 'anthropic') {
    return [{ role: 'user', content: results.map(r => ({ type: 'tool_result', tool_use_id: r.toolCallId, content: r.result })) }]
  }
  if (provider === 'gemini') {
    return [{ role: 'user', content: results.map(r => ({ functionResponse: { name: toolCalls.find(tc => tc.id === r.toolCallId)?.name || '', response: { result: r.result } } })) }]
  }
  return []
}
