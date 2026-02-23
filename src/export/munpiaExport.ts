/**
 * Munpia-specific export formatter.
 * - 5,500 char cutting per chapter
 * - Concise line breaks (single newline)
 * - Clean dialogue formatting
 */
import type { Chapter } from '@/types'
import { formatChapterText, splitByCharLimit, downloadTextFile } from './exportUtils'
import { nowUTC } from '@/lib/dateUtils'

/**
 * Format a single chapter for Munpia style.
 */
function formatMunpia(text: string): string {
  return text
    // Remove excessive blank lines (max 1 blank line)
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .trim()
}

/**
 * Export chapters in Munpia format.
 * If a chapter exceeds 5,500 chars, it's split into multiple parts.
 */
export function exportForMunpia(chapters: Chapter[]): void {
  const MAX_CHARS = 5500

  const sortedChapters = [...chapters]
    .filter(ch => ch.type === 'chapter')
    .sort((a, b) => a.order - b.order)

  const parts: string[] = []

  for (const chapter of sortedChapters) {
    const rawText = formatChapterText(chapter)
    if (!rawText) continue

    const formatted = formatMunpia(rawText)

    if (formatted.length <= MAX_CHARS) {
      parts.push(`[${chapter.title}]\n\n${formatted}`)
    } else {
      // Split into parts
      const chunks = splitByCharLimit(formatted, MAX_CHARS)
      chunks.forEach((chunk, i) => {
        const suffix = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : ''
        parts.push(`[${chapter.title}${suffix}]\n\n${chunk}`)
      })
    }
  }

  const output = parts.join('\n\n' + '─'.repeat(40) + '\n\n')
  downloadTextFile(output, `manuscript_munpia_${nowUTC()}.txt`)
}
