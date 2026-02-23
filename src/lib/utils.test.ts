/**
 * Unit tests for utils.
 * Tests: cn, generateId, calculateWordCount, formatNumber, getTextFromContent.
 */
import { describe, it, expect } from 'vitest'
import { cn, generateId, calculateWordCount, formatNumber, getTextFromContent } from '@/lib/utils'

describe('utils', () => {
  // ── cn ──

  describe('cn', () => {
    it('should return empty string for no inputs', () => {
      expect(cn()).toBe('')
    })

    it('should return a single class unchanged', () => {
      expect(cn('text-red-500')).toBe('text-red-500')
    })

    it('should merge multiple classes', () => {
      const result = cn('px-4', 'py-2', 'text-sm')
      expect(result).toContain('px-4')
      expect(result).toContain('py-2')
      expect(result).toContain('text-sm')
    })

    it('should handle conditional classes (falsy values excluded)', () => {
      const isActive = false
      const result = cn('base', isActive && 'active')
      expect(result).toBe('base')
      expect(result).not.toContain('active')
    })

    it('should include conditional classes when truthy', () => {
      const isActive = true
      const result = cn('base', isActive && 'active')
      expect(result).toContain('base')
      expect(result).toContain('active')
    })

    it('should merge conflicting Tailwind classes (last wins)', () => {
      const result = cn('text-red-500', 'text-blue-500')
      expect(result).toBe('text-blue-500')
    })

    it('should handle undefined and null inputs', () => {
      const result = cn('base', undefined, null, 'extra')
      expect(result).toContain('base')
      expect(result).toContain('extra')
    })
  })

  // ── generateId ──

  describe('generateId', () => {
    it('should return a string', () => {
      const id = generateId()
      expect(typeof id).toBe('string')
    })

    it('should return a valid UUID format', () => {
      const id = generateId()
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      expect(id).toMatch(uuidRegex)
    })

    it('should generate unique IDs between calls', () => {
      const id1 = generateId()
      const id2 = generateId()
      const id3 = generateId()
      expect(id1).not.toBe(id2)
      expect(id2).not.toBe(id3)
      expect(id1).not.toBe(id3)
    })
  })

  // ── calculateWordCount ──

  describe('calculateWordCount', () => {
    it('should return all zeros for empty text', () => {
      const stats = calculateWordCount('')
      expect(stats.characters).toBe(0)
      expect(stats.charactersNoSpaces).toBe(0)
      expect(stats.words).toBe(0)
    })

    it('should count a single word correctly', () => {
      const stats = calculateWordCount('hello')
      expect(stats.characters).toBe(5)
      expect(stats.charactersNoSpaces).toBe(5)
      expect(stats.words).toBe(1)
    })

    it('should count multiple words with spaces', () => {
      const stats = calculateWordCount('hello world test')
      expect(stats.characters).toBe(16)
      expect(stats.charactersNoSpaces).toBe(14)
      expect(stats.words).toBe(3)
    })

    it('should handle Korean text correctly', () => {
      const koreanText = '안녕하세요 세계'
      const stats = calculateWordCount(koreanText)
      expect(stats.characters).toBe(8)
      expect(stats.charactersNoSpaces).toBe(7)
      expect(stats.words).toBe(2)
    })

    it('should use custom CPM for reading time', () => {
      // 1000 characters no spaces with 1000 CPM = 1 min
      const text = 'a'.repeat(1000)
      const stats = calculateWordCount(text, 1000)
      expect(stats.readingTimeMin).toBe(1)
    })

    it('should use default 500 CPM for reading time', () => {
      // 500 characters no spaces with default 500 CPM = 1 min
      const text = 'a'.repeat(500)
      const stats = calculateWordCount(text)
      expect(stats.readingTimeMin).toBe(1)
    })

    it('should calculate pages200 correctly', () => {
      // 200 chars no spaces => 1 page
      const text = 'a'.repeat(200)
      const stats = calculateWordCount(text)
      expect(stats.pages200).toBe(1)

      // 201 chars no spaces => 2 pages
      const text2 = 'a'.repeat(201)
      const stats2 = calculateWordCount(text2)
      expect(stats2.pages200).toBe(2)
    })

    it('should calculate pagesA4 correctly (chars / 1800, min 1)', () => {
      // 1800 chars total => 1 page
      const text = 'a'.repeat(1800)
      const stats = calculateWordCount(text)
      expect(stats.pagesA4).toBe(1)

      // 1801 chars total => 2 pages
      const text2 = 'a'.repeat(1801)
      const stats2 = calculateWordCount(text2)
      expect(stats2.pagesA4).toBe(2)
    })

    it('should calculate pagesNovel correctly (chars / 600, min 1)', () => {
      // 600 chars total => 1 page
      const text = 'a'.repeat(600)
      const stats = calculateWordCount(text)
      expect(stats.pagesNovel).toBe(1)

      // 601 chars total => 2 pages
      const text2 = 'a'.repeat(601)
      const stats2 = calculateWordCount(text2)
      expect(stats2.pagesNovel).toBe(2)
    })

    it('should return minimum 1 for readingTimeMin', () => {
      const stats = calculateWordCount('a')
      expect(stats.readingTimeMin).toBe(1)
    })

    it('should return minimum 1 for pagesA4 and pagesNovel', () => {
      const stats = calculateWordCount('a')
      expect(stats.pagesA4).toBe(1)
      expect(stats.pagesNovel).toBe(1)
    })

    it('should return 0 for pages200 when empty text', () => {
      const stats = calculateWordCount('')
      expect(stats.pages200).toBe(0)
    })
  })

  // ── formatNumber ──

  describe('formatNumber', () => {
    it('should format numbers less than 1000 as locale string', () => {
      const result = formatNumber(0)
      expect(result).toBe('0')
    })

    it('should format 999 as locale string (below 1000 threshold)', () => {
      const result = formatNumber(999)
      expect(typeof result).toBe('string')
      // 999.toLocaleString() will be "999" in most locales
      expect(result).toContain('999')
    })

    it('should format 1000 with 천 suffix', () => {
      const result = formatNumber(1000)
      expect(result).toBe('1.0천')
    })

    it('should format 5500 with 천 suffix', () => {
      const result = formatNumber(5500)
      expect(result).toBe('5.5천')
    })

    it('should format 10000 with 만 suffix', () => {
      const result = formatNumber(10000)
      expect(result).toBe('1.0만')
    })

    it('should format 15000 with 만 suffix', () => {
      const result = formatNumber(15000)
      expect(result).toBe('1.5만')
    })

    it('should format 100000 with 만 suffix', () => {
      const result = formatNumber(100000)
      expect(result).toBe('10.0만')
    })

    it('should prioritize 만 over 천 at boundary (10000)', () => {
      // 10000 >= 10000, so it should use 만 not 천
      const result = formatNumber(10000)
      expect(result).toContain('만')
      expect(result).not.toContain('천')
    })

    it('should use 천 for 9999 (just below 만 threshold)', () => {
      const result = formatNumber(9999)
      expect(result).toContain('천')
    })
  })

  // ── getTextFromContent ──

  describe('getTextFromContent', () => {
    it('should return empty string for null', () => {
      expect(getTextFromContent(null)).toBe('')
    })

    it('should return empty string for undefined', () => {
      expect(getTextFromContent(undefined)).toBe('')
    })

    it('should return the string directly for plain string input', () => {
      expect(getTextFromContent('hello world')).toBe('hello world')
    })

    it('should return empty string for empty string input', () => {
      expect(getTextFromContent('')).toBe('')
    })

    it('should extract text from object with text property', () => {
      expect(getTextFromContent({ text: 'some text' })).toBe('some text')
    })

    it('should handle nested content array (TipTap JSONContent style)', () => {
      const content = {
        content: [
          { text: 'First paragraph' },
          { text: 'Second paragraph' },
        ],
      }
      const result = getTextFromContent(content)
      expect(result).toBe('First paragraph\nSecond paragraph')
    })

    it('should handle deeply nested content', () => {
      const content = {
        content: [
          {
            content: [
              { text: 'Deep text 1' },
              { text: 'Deep text 2' },
            ],
          },
          { text: 'Shallow text' },
        ],
      }
      const result = getTextFromContent(content)
      expect(result).toBe('Deep text 1\nDeep text 2\nShallow text')
    })

    it('should return empty string for object without text or content', () => {
      expect(getTextFromContent({ foo: 'bar' })).toBe('')
    })

    it('should return empty string for number input (falsy-like content)', () => {
      expect(getTextFromContent(0)).toBe('')
    })

    it('should handle mixed content nodes', () => {
      const content = {
        content: [
          { text: 'Text node' },
          { content: [{ text: 'Nested' }] },
          { foo: 'ignored' },
        ],
      }
      const result = getTextFromContent(content)
      expect(result).toBe('Text node\nNested\n')
    })
  })
})
