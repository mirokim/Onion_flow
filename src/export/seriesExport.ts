/**
 * Series/Kakaopage export formatter.
 * - Mobile readability optimized
 * - Double line breaks for spacing
 * - Dialogue formatting for mobile screens
 */
import type { Chapter } from '@/types'
import { formatChapterText, splitByCharLimit, downloadTextFile } from './exportUtils'

/**
 * Format text for mobile-optimized platforms (Series, Kakaopage).
 */
function formatForMobile(text: string): string {
  return text
    .split('\n')
    .map(line => {
      const trimmed = line.trimEnd()
      if (!trimmed) return ''
      return trimmed
    })
    // Double line breaks for paragraph spacing on mobile
    .join('\n\n')
    // But don't quadruple blank lines
    .replace(/\n{4,}/g, '\n\n\n')
    .trim()
}

/**
 * Export chapters for Naver Series / Kakaopage.
 */
export function exportForSeries(chapters: Chapter[], maxChars: number = 6000): void {
  const sortedChapters = [...chapters]
    .filter(ch => ch.type === 'chapter')
    .sort((a, b) => a.order - b.order)

  const parts: string[] = []

  for (const chapter of sortedChapters) {
    const rawText = formatChapterText(chapter)
    if (!rawText) continue

    const formatted = formatForMobile(rawText)

    if (maxChars <= 0 || formatted.length <= maxChars) {
      parts.push(`[${chapter.title}]\n\n\n${formatted}`)
    } else {
      const chunks = splitByCharLimit(formatted, maxChars)
      chunks.forEach((chunk, i) => {
        const suffix = chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : ''
        parts.push(`[${chapter.title}${suffix}]\n\n\n${chunk}`)
      })
    }
  }

  const output = parts.join('\n\n\n' + '━'.repeat(30) + '\n\n\n')
  downloadTextFile(output, `manuscript_series_${Date.now()}.txt`)
}
