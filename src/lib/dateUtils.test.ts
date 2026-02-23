/**
 * Unit tests for dateUtils.
 * Tests: nowUTC, formatDateUTC, formatRelativeTime, toISODateString.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nowUTC, formatDateUTC, formatRelativeTime, toISODateString } from '@/lib/dateUtils'

describe('dateUtils', () => {
  // ── nowUTC ──

  describe('nowUTC', () => {
    it('should return a number', () => {
      const result = nowUTC()
      expect(typeof result).toBe('number')
    })

    it('should return a value close to Date.now()', () => {
      const before = Date.now()
      const result = nowUTC()
      const after = Date.now()
      expect(result).toBeGreaterThanOrEqual(before)
      expect(result).toBeLessThanOrEqual(after)
    })
  })

  // ── formatDateUTC ──

  describe('formatDateUTC', () => {
    it('should format a known timestamp correctly', () => {
      // 2024-02-23 15:00:00 UTC = 1708700400000
      const result = formatDateUTC(1708700400000)
      expect(result).toBe('2024.02.23 15:00')
    })

    it('should zero-pad single-digit months', () => {
      // 2024-01-05 03:07:00 UTC
      const ts = Date.UTC(2024, 0, 5, 3, 7, 0) // January is month 0
      const result = formatDateUTC(ts)
      expect(result).toBe('2024.01.05 03:07')
    })

    it('should zero-pad single-digit days', () => {
      // 2024-12-01 09:05:00 UTC
      const ts = Date.UTC(2024, 11, 1, 9, 5, 0)
      const result = formatDateUTC(ts)
      expect(result).toBe('2024.12.01 09:05')
    })

    it('should zero-pad single-digit hours and minutes', () => {
      // 2024-06-15 01:02:00 UTC
      const ts = Date.UTC(2024, 5, 15, 1, 2, 0)
      const result = formatDateUTC(ts)
      expect(result).toBe('2024.06.15 01:02')
    })

    it('should format epoch (0) correctly', () => {
      const result = formatDateUTC(0)
      expect(result).toBe('1970.01.01 00:00')
    })

    it('should handle midnight correctly', () => {
      const ts = Date.UTC(2025, 5, 30, 0, 0, 0)
      const result = formatDateUTC(ts)
      expect(result).toBe('2025.06.30 00:00')
    })

    it('should handle end of day correctly', () => {
      const ts = Date.UTC(2025, 11, 31, 23, 59, 0)
      const result = formatDateUTC(ts)
      expect(result).toBe('2025.12.31 23:59')
    })
  })

  // ── formatRelativeTime ──

  describe('formatRelativeTime', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(1700000000000)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "방금 전" for less than 1 minute ago', () => {
      const now = 1700000000000
      // 30 seconds ago
      expect(formatRelativeTime(now - 30000)).toBe('방금 전')
    })

    it('should return "방금 전" for 0 seconds ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now)).toBe('방금 전')
    })

    it('should return "1분 전" for exactly 1 minute ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now - 60000)).toBe('1분 전')
    })

    it('should return "5분 전" for 5 minutes ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now - 5 * 60000)).toBe('5분 전')
    })

    it('should return "59분 전" for 59 minutes ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now - 59 * 60000)).toBe('59분 전')
    })

    it('should return "1시간 전" for exactly 1 hour ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now - 60 * 60000)).toBe('1시간 전')
    })

    it('should return "2시간 전" for 2 hours ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now - 2 * 60 * 60000)).toBe('2시간 전')
    })

    it('should return "23시간 전" for 23 hours ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now - 23 * 60 * 60000)).toBe('23시간 전')
    })

    it('should return "1일 전" for exactly 1 day ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now - 24 * 60 * 60000)).toBe('1일 전')
    })

    it('should return "15일 전" for 15 days ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now - 15 * 24 * 60 * 60000)).toBe('15일 전')
    })

    it('should return "29일 전" for 29 days ago', () => {
      const now = 1700000000000
      expect(formatRelativeTime(now - 29 * 24 * 60 * 60000)).toBe('29일 전')
    })

    it('should fall back to formatDateUTC for 30+ days ago', () => {
      const now = 1700000000000

      const thirtyDaysAgo = now - 30 * 24 * 60 * 60000
      const result = formatRelativeTime(thirtyDaysAgo)

      // Should return the absolute UTC date format, not a relative string
      expect(result).toMatch(/^\d{4}\.\d{2}\.\d{2} \d{2}:\d{2}$/)
      expect(result).toBe(formatDateUTC(thirtyDaysAgo))
    })

    it('should fall back to formatDateUTC for timestamps far in the past', () => {
      const now = 1700000000000

      const oneYearAgo = now - 365 * 24 * 60 * 60000
      const result = formatRelativeTime(oneYearAgo)
      expect(result).toBe(formatDateUTC(oneYearAgo))
    })
  })

  // ── toISODateString ──

  describe('toISODateString', () => {
    it('should return YYYY-MM-DD format for a known timestamp', () => {
      // 2024-02-23 15:00:00 UTC
      const result = toISODateString(1708700400000)
      expect(result).toBe('2024-02-23')
    })

    it('should return 1970-01-01 for epoch (0)', () => {
      expect(toISODateString(0)).toBe('1970-01-01')
    })

    it('should return correct date for end of year', () => {
      const ts = Date.UTC(2025, 11, 31, 23, 59, 59)
      expect(toISODateString(ts)).toBe('2025-12-31')
    })

    it('should return correct date for start of year', () => {
      const ts = Date.UTC(2025, 0, 1, 0, 0, 0)
      expect(toISODateString(ts)).toBe('2025-01-01')
    })

    it('should match YYYY-MM-DD regex pattern', () => {
      const result = toISODateString(Date.now())
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })
})
