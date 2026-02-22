import type { JSONContent } from '@tiptap/react'

const Q_OPEN  = '\u0022\u201C\u201D\u300C\uFF02'
const Q_CLOSE = '\u0022\u201C\u201D\u300D\uFF02'
const Q_ALL   = '\u0022\u201C\u201D\u300C\u300D\uFF02'

const RE_SPEAKER_QUOTE = new RegExp(`^(.+?)[\uFF1A:]\\s*[${Q_OPEN}](.+)[${Q_CLOSE}]$`)
const RE_SPEAKER_DASH  = /^(.{1,20}?)\s*(?:-\s+|─\s*|—\s*)(.+)$/
const RE_FULL_QUOTE    = new RegExp(`^[${Q_OPEN}].*[${Q_CLOSE}]$`)
const RE_INLINE_QUOTE  = new RegExp(`[${Q_OPEN}][^${Q_ALL}]{5,}[${Q_CLOSE}]`)
const RE_INLINE_SPLIT  = new RegExp(`([${Q_OPEN}][^${Q_ALL}]+[${Q_CLOSE}])`, 'g')
const RE_INLINE_MATCH  = new RegExp(`^[${Q_OPEN}]([^${Q_ALL}]+)[${Q_CLOSE}]$`)

export function textToTipTapContent(text: string): JSONContent {
  const lines = text.split('\n')
  const nodes: JSONContent[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed.startsWith('### ')) {
      nodes.push({ type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: trimmed.slice(4) }] })
    } else if (trimmed.startsWith('## ')) {
      nodes.push({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: trimmed.slice(3) }] })
    } else if (trimmed.startsWith('# ')) {
      nodes.push({ type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: trimmed.slice(2) }] })
    } else if (trimmed === '---' || trimmed === '***') {
      nodes.push({ type: 'horizontalRule' })
    } else if (RE_SPEAKER_QUOTE.test(trimmed)) {
      const m = trimmed.match(RE_SPEAKER_QUOTE)!
      nodes.push({ type: 'dialogueBlock', attrs: { speaker: m[1].trim() }, content: [{ type: 'text', text: m[2] }] })
    } else if (RE_SPEAKER_DASH.test(trimmed)) {
      const m = trimmed.match(RE_SPEAKER_DASH)!
      nodes.push({ type: 'dialogueBlock', attrs: { speaker: m[1].trim() }, content: [{ type: 'text', text: m[2].trim() }] })
    } else if (RE_FULL_QUOTE.test(trimmed)) {
      const inner = trimmed.slice(1, -1)
      const colonMatch = inner.match(/^([^:\uFF1A]{1,20})[\uFF1A:]\s*(.+)/)
      if (colonMatch) {
        nodes.push({ type: 'dialogueBlock', attrs: { speaker: colonMatch[1].trim() }, content: [{ type: 'text', text: colonMatch[2] }] })
      } else {
        nodes.push({ type: 'dialogueBlock', content: [{ type: 'text', text: inner }] })
      }
    } else if (RE_INLINE_QUOTE.test(trimmed)) {
      const parts = trimmed.split(RE_INLINE_SPLIT)
      for (const part of parts) {
        const p = part.trim()
        if (!p) continue
        const qm = p.match(RE_INLINE_MATCH)
        if (qm) {
          nodes.push({ type: 'dialogueBlock', content: [{ type: 'text', text: qm[1] }] })
        } else {
          nodes.push({ type: 'paragraph', content: [{ type: 'text', text: p }] })
        }
      }
    } else if (/^\(.*\)$/.test(trimmed) || /^\[.*\]$/.test(trimmed)) {
      nodes.push({ type: 'narrationBlock', content: [{ type: 'text', text: trimmed.slice(1, -1) }] })
    } else {
      nodes.push({ type: 'paragraph', content: [{ type: 'text', text: trimmed }] })
    }
  }

  if (nodes.length === 0) {
    nodes.push({ type: 'paragraph', content: [{ type: 'text', text: '' }] })
  }
  return { type: 'doc', content: nodes }
}

export function appendToTipTapContent(existing: JSONContent | null, text: string): JSONContent {
  const newContent = textToTipTapContent(text)
  if (!existing || !existing.content) return newContent
  return { type: 'doc', content: [...existing.content, ...(newContent.content || [])] }
}

export function tipTapToText(content: JSONContent | null): string {
  if (!content || !content.content) return ''
  return content.content.map(node => {
    if (node.type === 'horizontalRule') return '---'
    if (node.type === 'heading') {
      const level = node.attrs?.level || 1
      const prefix = '#'.repeat(level) + ' '
      const text = node.content?.map(n => n.text || '').join('') || ''
      return prefix + text
    }
    const text = node.content?.map(n => n.text || '').join('') || ''
    if (node.type === 'dialogueBlock') {
      const speaker = node.attrs?.speaker as string | undefined
      return speaker ? `${speaker}: "${text}"` : `"${text}"`
    }
    if (node.type === 'narrationBlock') return `(${text})`
    return text
  }).join('\n')
}
