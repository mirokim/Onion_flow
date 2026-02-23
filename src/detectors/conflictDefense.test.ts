/**
 * Unit tests for conflictDefense.
 * Tests: detectConflicts() with character hair color consistency checks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/stores/worldStore', () => ({
  useWorldStore: {
    getState: vi.fn(() => ({
      characters: [],
      worldSettings: [],
    })),
  },
}))
vi.mock('@/stores/wikiStore', () => ({
  useWikiStore: {
    getState: vi.fn(() => ({
      entries: [],
    })),
  },
}))

import { detectConflicts } from './conflictDefense'
import { useWorldStore } from '@/stores/worldStore'

describe('conflictDefense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function setupWorldStore(characters: any[], worldSettings: any[] = []) {
    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters,
      worldSettings,
    } as any)
  }

  // ── detectConflicts ──

  describe('detectConflicts', () => {
    it('returns empty array when no characters exist', () => {
      setupWorldStore([], [])
      const result = detectConflicts('아무 텍스트입니다.')
      expect(result).toEqual([])
    })

    it('returns empty array when character is not mentioned in text', () => {
      setupWorldStore([
        { id: 'char-1', name: '영희', appearance: '검은 머리카락' },
      ])

      const result = detectConflicts('철수는 걸어갔다.')
      expect(result).toEqual([])
    })

    it('returns no conflict when text hair color matches appearance', () => {
      setupWorldStore([
        { id: 'char-1', name: '영희', appearance: '검은 머리카락이 인상적이다' },
      ])

      const text = '영희는 검은 머리를 쓸어 넘겼다.'
      const result = detectConflicts(text)
      expect(result).toEqual([])
    })

    it('detects conflict when text mentions different hair color than appearance', () => {
      setupWorldStore([
        { id: 'char-1', name: '영희', appearance: '검은 머리카락이 인상적이다' },
      ])

      const text = '영희는 금발 머리를 쓸어 넘겼다.'
      const result = detectConflicts(text)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(
        expect.objectContaining({
          type: 'character',
          entityName: '영희',
          severity: 'warning',
        }),
      )
      expect(result[0].conflictDescription).toContain('검은')
      expect(result[0].conflictDescription).toContain('금발')
    })

    it('returns no conflict when character has no appearance setting', () => {
      setupWorldStore([
        { id: 'char-1', name: '영희', appearance: '' },
      ])

      const result = detectConflicts('영희는 금발 머리를 넘겼다.')
      expect(result).toEqual([])
    })

    it('returns no conflict when appearance has no known hair color', () => {
      setupWorldStore([
        { id: 'char-1', name: '영희', appearance: '키가 크고 날씬하다' },
      ])

      const result = detectConflicts('영희는 금발 머리를 넘겼다.')
      expect(result).toEqual([])
    })

    it('detects conflicts for multiple characters independently', () => {
      setupWorldStore([
        { id: 'char-1', name: '영희', appearance: '검은 머리카락' },
        { id: 'char-2', name: '철수', appearance: '금발' },
      ])

      // 영희's appearance says '검은' but text says '금발 머리' near 영희
      // 철수's appearance says '금발' but text says '검은 머리' near 철수
      const text = '영희는 금발 머리를 넘겼다. 그리고 철수는 검은 머리를 정리했다.'
      const result = detectConflicts(text)
      expect(result.length).toBeGreaterThanOrEqual(1)
    })

    it('detects conflict for silver vs red hair', () => {
      setupWorldStore([
        { id: 'char-1', name: '아린', appearance: '은발의 소녀' },
      ])

      const text = '아린은 빨간 머리를 흔들었다.'
      const result = detectConflicts(text)
      expect(result).toHaveLength(1)
      expect(result[0].conflictDescription).toContain('은발')
      expect(result[0].conflictDescription).toContain('빨간')
    })

    it('returns correct position pointing to character name in text', () => {
      setupWorldStore([
        { id: 'char-1', name: '영희', appearance: '검은 머리' },
      ])

      const text = '오늘 영희는 금발 머리를 보였다.'
      const result = detectConflicts(text)
      expect(result).toHaveLength(1)
      expect(result[0].position).toBe(text.indexOf('영희'))
    })

    it('only checks "X 머리" pattern, not bare color words', () => {
      setupWorldStore([
        { id: 'char-1', name: '영희', appearance: '검은 머리' },
      ])

      // '금발' is in text but NOT as '금발 머리' pattern
      const text = '영희는 금발인 친구를 만났다.'
      const result = detectConflicts(text)
      expect(result).toEqual([])
    })
  })
})
