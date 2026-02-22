import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { WordCountStats } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function calculateWordCount(text: string, readingSpeedCPM = 500): WordCountStats {
  const characters = text.length
  const charactersNoSpaces = text.replace(/\s/g, '').length
  const words = text.trim() ? text.trim().split(/\s+/).length : 0

  return {
    characters,
    charactersNoSpaces,
    words,
    pages200: Math.ceil(charactersNoSpaces / 200),
    pagesA4: Math.max(1, Math.ceil(characters / 1800)),
    pagesNovel: Math.max(1, Math.ceil(characters / 600)),
    readingTimeMin: Math.max(1, Math.round(charactersNoSpaces / readingSpeedCPM)),
  }
}

export function formatNumber(n: number): string {
  if (n >= 10000) {
    return `${(n / 10000).toFixed(1)}만`
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}천`
  }
  return n.toLocaleString()
}

export function getTextFromContent(content: any): string {
  if (!content) return ''
  if (typeof content === 'string') return content
  if (content.text) return content.text
  if (content.content) {
    return content.content.map((node: any) => getTextFromContent(node)).join('\n')
  }
  return ''
}
