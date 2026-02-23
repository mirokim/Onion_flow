/**
 * Unit tests for foreshadowDetector.
 * Tests: detectForeshadowMentions(), detectItemMentions()
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/stores/worldStore', () => ({
  useWorldStore: {
    getState: vi.fn(() => ({
      foreshadows: [],
      items: [],
    })),
  },
}))

import { detectForeshadowMentions, detectItemMentions } from './foreshadowDetector'
import { useWorldStore } from '@/stores/worldStore'

describe('foreshadowDetector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── detectForeshadowMentions ──

  describe('detectForeshadowMentions', () => {
    it('returns empty array when no foreshadows exist', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [],
        items: [],
      } as any)

      const result = detectForeshadowMentions('어떤 텍스트입니다.')
      expect(result).toEqual([])
    })

    it('matches foreshadow by title and returns match with position', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [
          { id: 'fs-1', title: '검은 반지', description: '' },
        ],
        items: [],
      } as any)

      const text = '그는 검은 반지를 주머니에 넣었다.'
      const result = detectForeshadowMentions(text)
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(
        expect.objectContaining({
          foreshadowId: 'fs-1',
          title: '검은 반지',
          matchedText: '검은 반지',
          position: text.indexOf('검은 반지'),
        }),
      )
    })

    it('matches foreshadow by description keyword', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [
          { id: 'fs-1', title: '숨겨진예언', description: '고대의 예언서에 기록된 운명의 열쇠' },
        ],
        items: [],
      } as any)

      // Title '숨겨진예언' is not in text, but description keyword '고대의' should match
      const result = detectForeshadowMentions('고대의 전설이 전해진다.')
      expect(result).toHaveLength(1)
      expect(result[0].matchedText).toBe('고대의')
    })

    it('returns empty array when foreshadow is not found in text', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [
          { id: 'fs-1', title: '마법의 거울', description: '빛나는 수정 조각' },
        ],
        items: [],
      } as any)

      const result = detectForeshadowMentions('평범한 하루가 지나갔다.')
      expect(result).toEqual([])
    })

    it('detects multiple foreshadows in the same text', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [
          { id: 'fs-1', title: '검은 반지', description: '' },
          { id: 'fs-2', title: '붉은 보석', description: '' },
        ],
        items: [],
      } as any)

      const result = detectForeshadowMentions('검은 반지와 붉은 보석이 테이블 위에 있었다.')
      expect(result).toHaveLength(2)
      expect(result.map(m => m.foreshadowId)).toContain('fs-1')
      expect(result.map(m => m.foreshadowId)).toContain('fs-2')
    })

    it('returns at most one match per foreshadow', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [
          { id: 'fs-1', title: '검', description: '날카로운 검이 빛났다' },
        ],
        items: [],
      } as any)

      // Both title '검' and description keyword '날카로운' appear in text
      const result = detectForeshadowMentions('날카로운 검이 빛 속에서 나타났다.')
      expect(result).toHaveLength(1)
    })

    it('uses only first 5 keywords from description (2+ char words)', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [
          { id: 'fs-1', title: '없는제목이다', description: '아 큰 의미' },
        ],
        items: [],
      } as any)

      // Single-char words '아' and '큰' are filtered out (< 2 chars)
      // Only '의미' (2 chars) is used as keyword
      const result = detectForeshadowMentions('아 이건 큰 일이다.')
      expect(result).toEqual([])
    })

    it('returns correct position of the matched text', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [
          { id: 'fs-1', title: '운명의 열쇠', description: '' },
        ],
        items: [],
      } as any)

      const text = '그가 찾던 운명의 열쇠가 여기에 있었다.'
      const result = detectForeshadowMentions(text)
      expect(result).toHaveLength(1)
      expect(result[0].position).toBe(text.indexOf('운명의 열쇠'))
    })

    it('skips foreshadow with empty title', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [
          { id: 'fs-1', title: '', description: '설명 키워드' },
        ],
        items: [],
      } as any)

      const result = detectForeshadowMentions('설명 키워드가 포함된 텍스트.')
      expect(result).toEqual([])
    })
  })

  // ── detectItemMentions ──

  describe('detectItemMentions', () => {
    it('returns empty array when no items exist', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [],
        items: [],
      } as any)

      const result = detectItemMentions('어떤 텍스트입니다.')
      expect(result).toEqual([])
    })

    it('detects item with acquire keyword and returns acquired context', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [],
        items: [
          { id: 'item-1', name: '마법의 검' },
        ],
      } as any)

      const result = detectItemMentions('그는 마법의 검을 획득했다.')
      expect(result).toHaveLength(1)
      expect(result[0].context).toBe('acquired')
    })

    it('detects all acquire keywords correctly', () => {
      const acquireKeywords = ['획득', '얻', '받았', '손에 넣', '주웠', '발견']
      for (const kw of acquireKeywords) {
        vi.mocked(useWorldStore.getState).mockReturnValue({
          foreshadows: [],
          items: [
            { id: 'item-1', name: '성검' },
          ],
        } as any)

        const result = detectItemMentions(`그는 성검을 ${kw}다.`)
        expect(result).toHaveLength(1)
        expect(result[0].context).toBe('acquired')
      }
    })

    it('detects item with lost keyword and returns lost context', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [],
        items: [
          { id: 'item-1', name: '마법의 검' },
        ],
      } as any)

      const result = detectItemMentions('그는 마법의 검을 잃어버렸다.')
      expect(result).toHaveLength(1)
      expect(result[0].context).toBe('lost')
    })

    it('detects all lost keywords correctly', () => {
      const lostKeywords = ['잃', '빼앗', '떨어뜨', '버렸', '파괴']
      for (const kw of lostKeywords) {
        vi.mocked(useWorldStore.getState).mockReturnValue({
          foreshadows: [],
          items: [
            { id: 'item-1', name: '성검' },
          ],
        } as any)

        const result = detectItemMentions(`그는 성검을 ${kw}다.`)
        expect(result).toHaveLength(1)
        expect(result[0].context).toBe('lost')
      }
    })

    it('defaults to mentioned context when no acquire or lost keywords present', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [],
        items: [
          { id: 'item-1', name: '마법의 검' },
        ],
      } as any)

      const result = detectItemMentions('그는 마법의 검을 바라보았다.')
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual(
        expect.objectContaining({
          itemId: 'item-1',
          itemName: '마법의 검',
          context: 'mentioned',
        }),
      )
    })

    it('returns empty array when item is not mentioned in text', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [],
        items: [
          { id: 'item-1', name: '마법의 검' },
        ],
      } as any)

      const result = detectItemMentions('평범한 하루가 지나갔다.')
      expect(result).toEqual([])
    })

    it('returns correct position of item mention', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [],
        items: [
          { id: 'item-1', name: '용의 비늘' },
        ],
      } as any)

      const text = '상자 안에 용의 비늘이 있었다.'
      const result = detectItemMentions(text)
      expect(result).toHaveLength(1)
      expect(result[0].position).toBe(text.indexOf('용의 비늘'))
    })

    it('handles multiple items with separate mentions', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        foreshadows: [],
        items: [
          { id: 'item-1', name: '마법의 검' },
          { id: 'item-2', name: '방어의 방패' },
        ],
      } as any)

      const result = detectItemMentions('그는 마법의 검과 방어의 방패를 들었다.')
      expect(result).toHaveLength(2)
      expect(result.map(m => m.itemId)).toContain('item-1')
      expect(result.map(m => m.itemId)).toContain('item-2')
    })
  })
})
