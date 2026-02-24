/**
 * Common export utilities for all platform templates.
 */
import type { Chapter } from '@/types'

/**
 * Extract plain text from TipTap JSONContent.
 */
export function extractPlainText(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content

  let text = ''

  if (content.type === 'text') {
    return content.text || ''
  }

  if (content.content && Array.isArray(content.content)) {
    for (const child of content.content) {
      const childText = extractPlainText(child)
      text += childText

      // Add appropriate spacing after block elements
      if (['paragraph', 'heading', 'dialogueBlock', 'narrationBlock', 'horizontalRule'].includes(child.type)) {
        text += '\n'
      }
    }
  }

  return text
}

/**
 * Split text into chunks of approximately `maxChars` length,
 * breaking at paragraph boundaries.
 */
export function splitByCharLimit(text: string, maxChars: number): string[] {
  const paragraphs = text.split('\n')
  const chunks: string[] = []
  let current = ''

  for (const para of paragraphs) {
    if (current.length + para.length + 1 > maxChars && current.length > 0) {
      chunks.push(current.trim())
      current = ''
    }
    current += para + '\n'
  }

  if (current.trim()) {
    chunks.push(current.trim())
  }

  return chunks
}

/**
 * Format chapter content for export, converting TipTap JSON to plain text.
 */
export function formatChapterText(chapter: Chapter): string {
  if (!chapter.content) return ''
  return extractPlainText(chapter.content).trim()
}

/**
 * Create a downloadable text file.
 */
export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Create a downloadable JSON file.
 */
export function downloadJsonFile(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/**
 * Format dialogue lines for web novel platforms.
 * Ensures proper quotation marks and spacing.
 */
export function formatDialogue(text: string): string {
  return text
    // Convert paired straight double quotes to curly quotes
    .replace(/"([^"]*)"/g, '\u201C$1\u201D')
}

/**
 * Count characters excluding spaces and line breaks.
 */
export function countCharsNoSpaces(text: string): number {
  return text.replace(/[\s\n\r]/g, '').length
}
