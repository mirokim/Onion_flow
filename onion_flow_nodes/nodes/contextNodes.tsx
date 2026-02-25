/**
 * Context node plugins: character, memory, motivation, event, wiki, image_load, document_load
 * These nodes supply character/world information to the AI engines.
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import { CharacterNodeBody } from '../_base/CharacterNodeBody'
import { ImageLoadBody } from '../_base/ImageLoadBody'
import { DocumentLoadBody } from '../_base/DocumentLoadBody'
import { WikiEntrySelector } from '../_base/WikiEntrySelector'
import type { NodeBodyProps } from '../plugin'
import type { CanvasNode, WikiEntry } from '@/types'

// ── Shared helper ─────────────────────────────────────────────────────────────

function findWikiEntry(node: CanvasNode, wikiEntries: WikiEntry[], nodeTypeName: string) {
  const wikiEntryId = node.data.wikiEntryId
  if (!wikiEntryId) {
    console.warn(`[Plugin:${node.type}] 노드(${node.id})에 위키 항목이 선택되지 않았습니다.`)
    return null
  }
  const entry = wikiEntries.find(e => e.id === wikiEntryId)
  if (!entry) {
    console.warn(`[Plugin:${node.type}] 노드(${node.id})의 위키 항목(${wikiEntryId})을 찾을 수 없습니다.`)
  }
  return entry ?? null
}

// ── memory ────────────────────────────────────────────────────────────────────

function MemoryNodeBody({ nodeId, data }: NodeBodyProps) {
  return <WikiEntrySelector nodeId={nodeId} data={data} category="character_memory" placeholder="기억 항목 선택..." />
}

registerPlugin({
  definition: {
    type: 'memory',
    label: 'Memory',
    labelKo: '기억',
    category: 'context',
    tags: ['context', 'character', 'wiki'],
    color: NODE_CATEGORY_COLORS.context,
    inputs: [{ id: 'plot_in', label: '플롯', type: 'target', position: 'left', acceptsTypes: ['PLOT', 'CONTEXT', '*'] }],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right', dataType: 'CONTEXT' }],
    defaultData: { wikiEntryId: null, label: '기억' },
  },
  bodyComponent: MemoryNodeBody,
  extractData: (node, wikiEntries) => {
    const entry = findWikiEntry(node, wikiEntries, 'memory')
    return entry ? `[기억] ${entry.content}` : null
  },
  buildPromptSegment: (node, wikiEntries) => {
    const entry = findWikiEntry(node, wikiEntries, 'memory')
    if (!entry) return null
    return { role: 'character_context', content: `[기억/배경]\n${entry.content}`, priority: 10 }
  },
})

// ── motivation ────────────────────────────────────────────────────────────────

function MotivationNodeBody({ nodeId, data }: NodeBodyProps) {
  return <WikiEntrySelector nodeId={nodeId} data={data} category="character_motivation" placeholder="동기 항목 선택..." />
}

registerPlugin({
  definition: {
    type: 'motivation',
    label: 'Motivation',
    labelKo: '동기',
    category: 'context',
    tags: ['context', 'character', 'wiki'],
    color: NODE_CATEGORY_COLORS.context,
    inputs: [{ id: 'plot_in', label: '플롯', type: 'target', position: 'left', acceptsTypes: ['PLOT', 'CONTEXT', '*'] }],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right', dataType: 'CONTEXT' }],
    defaultData: { wikiEntryId: null, label: '동기' },
  },
  bodyComponent: MotivationNodeBody,
  extractData: (node, wikiEntries) => {
    const entry = findWikiEntry(node, wikiEntries, 'motivation')
    return entry ? `[동기] ${entry.content}` : null
  },
  buildPromptSegment: (node, wikiEntries) => {
    const entry = findWikiEntry(node, wikiEntries, 'motivation')
    if (!entry) return null
    return { role: 'character_context', content: `[캐릭터 동기]\n${entry.content}`, priority: 10 }
  },
})

// ── character ─────────────────────────────────────────────────────────────────

function CharacterBody({ nodeId, data, selected }: NodeBodyProps) {
  return (
    <>
      <WikiEntrySelector nodeId={nodeId} data={data} category="character" placeholder="캐릭터 항목 선택..." />
      <CharacterNodeBody data={data} nodeId={nodeId} />
    </>
  )
}

registerPlugin({
  definition: {
    type: 'character',
    label: 'Character',
    labelKo: '캐릭터',
    category: 'context',
    tags: ['context', 'character', 'wiki'],
    color: NODE_CATEGORY_COLORS.context,
    inputs: [
      { id: 'motivation_in', label: '동기', type: 'target', position: 'left', acceptsTypes: ['CONTEXT'] },
      { id: 'memory_in', label: '기억', type: 'target', position: 'left', acceptsTypes: ['CONTEXT'] },
    ],
    outputs: [
      { id: 'out', label: 'Data', type: 'source', position: 'right', dataType: 'CHARACTER' },
      { id: 'timeline', label: 'Timeline', type: 'source', position: 'right', dataType: 'CHARACTER' },
      { id: 'state', label: 'State', type: 'source', position: 'right', dataType: 'CHARACTER' },
    ],
    defaultData: { wikiEntryId: null, label: 'Character' },
  },
  bodyComponent: CharacterBody,
  extractData: (node, wikiEntries) => {
    const entry = node.data.wikiEntryId
      ? wikiEntries.find(e => e.id === node.data.wikiEntryId)
      : null
    const parts: string[] = []
    if (entry) parts.push(`[캐릭터: ${entry.title}] ${entry.content}`)
    const embeddedCards = [
      { key: 'personalityWikiEntryId', label: '성격' },
      { key: 'appearanceWikiEntryId', label: '외모' },
      { key: 'memoryWikiEntryId', label: '기억' },
    ] as const
    for (const card of embeddedCards) {
      const id = node.data[card.key]
      if (id) {
        const sub = wikiEntries.find(e => e.id === id)
        if (sub) parts.push(`[${card.label}] ${sub.content}`)
      }
    }
    return parts.length > 0 ? parts.join('\n') : null
  },
  buildPromptSegment: (node, wikiEntries) => {
    const entry = node.data.wikiEntryId
      ? wikiEntries.find(e => e.id === node.data.wikiEntryId)
      : null
    const parts: string[] = []
    if (entry) parts.push(`[캐릭터: ${entry.title}]\n${entry.content}`)
    const embeddedCards = [
      { key: 'personalityWikiEntryId', label: '성격 설정' },
      { key: 'appearanceWikiEntryId', label: '외모 설정' },
      { key: 'memoryWikiEntryId', label: '기억/배경' },
    ] as const
    for (const card of embeddedCards) {
      const id = node.data[card.key]
      if (id) {
        const sub = wikiEntries.find(e => e.id === id)
        if (sub) parts.push(`[${card.label}]\n${sub.content}`)
      }
    }
    if (parts.length === 0) return null
    return { role: 'character_context', content: parts.join('\n'), priority: 10 }
  },
})

// ── event ─────────────────────────────────────────────────────────────────────

function EventNodeBody({ nodeId, data }: NodeBodyProps) {
  return <WikiEntrySelector nodeId={nodeId} data={data} category="event" placeholder="사건 항목 선택..." />
}

registerPlugin({
  definition: {
    type: 'event',
    label: 'Event/Environment',
    labelKo: '사건/환경',
    category: 'context',
    tags: ['context', 'wiki'],
    color: NODE_CATEGORY_COLORS.context,
    inputs: [],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right', dataType: 'CONTEXT' }],
    defaultData: { wikiEntryId: null, label: 'Event' },
  },
  bodyComponent: EventNodeBody,
  extractData: (node, wikiEntries) => {
    const entry = findWikiEntry(node, wikiEntries, 'event')
    return entry ? `[사건] ${entry.content}` : null
  },
  buildPromptSegment: (node, wikiEntries) => {
    const entry = findWikiEntry(node, wikiEntries, 'event')
    if (!entry) return null
    return { role: 'event_context', content: `[사건/환경]\n${entry.content}`, priority: 9 }
  },
})

// ── wiki ──────────────────────────────────────────────────────────────────────

function WikiNodeBody({ nodeId, data }: NodeBodyProps) {
  return <WikiEntrySelector nodeId={nodeId} data={data} category="all" placeholder="위키 항목 선택..." />
}

registerPlugin({
  definition: {
    type: 'wiki',
    label: 'Wiki Data',
    labelKo: '위키 데이터',
    category: 'context',
    tags: ['context', 'wiki', 'data'],
    color: NODE_CATEGORY_COLORS.context,
    inputs: [],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right', dataType: 'CONTEXT' }],
    defaultData: { wikiEntryId: null, label: 'Wiki' },
  },
  bodyComponent: WikiNodeBody,
  extractData: (node, wikiEntries) => {
    const entry = findWikiEntry(node, wikiEntries, 'wiki')
    return entry ? `[위키: ${entry.title}] ${entry.content}` : null
  },
  buildPromptSegment: (node, wikiEntries) => {
    const entry = findWikiEntry(node, wikiEntries, 'wiki')
    if (!entry) return null
    return { role: 'wiki_context', content: `[위키 데이터: ${entry.title}]\n${entry.content}`, priority: 8 }
  },
})

// ── image_load ────────────────────────────────────────────────────────────────

function ImageLoadNodeBody({ nodeId, data, selected }: NodeBodyProps) {
  return <ImageLoadBody data={data} nodeId={nodeId} selected={selected} />
}

registerPlugin({
  definition: {
    type: 'image_load',
    label: 'Image Load',
    labelKo: '이미지 로드',
    category: 'context',
    tags: ['context', 'data'],
    color: NODE_CATEGORY_COLORS.context,
    inputs: [],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right', dataType: 'CONTEXT' }],
    defaultData: { images: [], label: '이미지 로드' },
  },
  bodyComponent: ImageLoadNodeBody,
  extractData: (node) => {
    const images = (node.data.images || []) as Array<{ name: string }>
    if (images.length === 0) return null
    return `[이미지 데이터] ${images.length}개 이미지 첨부됨: ${images.map(i => i.name).join(', ')}`
  },
  buildPromptSegment: (node) => {
    const images = (node.data.images || []) as Array<{ name: string }>
    if (images.length === 0) return null
    return {
      role: 'image_context',
      content: `[이미지 데이터] ${images.length}개 이미지가 첨부되었습니다 (${images.map(i => i.name).join(', ')}). 이미지를 참고하여 캐릭터의 외모, 분위기, 배경 등을 반영하세요.`,
      priority: 9,
    }
  },
})

// ── document_load ─────────────────────────────────────────────────────────────

function DocumentLoadNodeBody({ nodeId, data, selected }: NodeBodyProps) {
  return <DocumentLoadBody data={data} nodeId={nodeId} selected={selected} />
}

registerPlugin({
  definition: {
    type: 'document_load',
    label: 'Document Load',
    labelKo: '문서 로드',
    category: 'context',
    tags: ['context', 'data'],
    color: NODE_CATEGORY_COLORS.context,
    inputs: [],
    outputs: [{ id: 'out', label: 'Data', type: 'source', position: 'right', dataType: 'CONTEXT' }],
    defaultData: { documents: [], label: '문서 로드' },
  },
  bodyComponent: DocumentLoadNodeBody,
  extractData: (node) => {
    const docs = (node.data.documents || []) as Array<{ name: string; content: string; mimeType: string }>
    if (docs.length === 0) return null
    const textParts = docs
      .filter(d => d.content)
      .map(d => `[문서: ${d.name}]\n${d.content}`)
    const pdfNames = docs
      .filter(d => d.mimeType === 'application/pdf' && !d.content)
      .map(d => d.name)
    const parts: string[] = [...textParts]
    if (pdfNames.length > 0) parts.push(`[PDF 파일: ${pdfNames.join(', ')}]`)
    return parts.length > 0 ? parts.join('\n\n') : null
  },
  buildPromptSegment: (node) => {
    const docs = (node.data.documents || []) as Array<{ name: string; content: string; mimeType: string }>
    if (docs.length === 0) return null
    const textContent = docs
      .filter(d => d.content)
      .map(d => `[문서: ${d.name}]\n${d.content}`)
      .join('\n\n')
    if (!textContent) return null
    return { role: 'document_context', content: textContent, priority: 8 }
  },
})
