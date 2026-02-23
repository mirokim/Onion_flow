/**
 * Unit tests for emotionTracker.
 * Tests: detectEmotionsFromText(), recordEmotion(), getCharacterEmotionArc(), runEmotionDetection()
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/stores/editorStore', () => ({
  useEditorStore: {
    getState: vi.fn(() => ({
      setEmotionData: vi.fn(),
      emotionData: {},
    })),
  },
}))
vi.mock('@/stores/worldStore', () => ({
  useWorldStore: {
    getState: vi.fn(() => ({
      characters: [],
    })),
  },
}))
vi.mock('@/ai/constants', async () => {
  const actual = await vi.importActual('@/ai/constants')
  return actual
})

import {
  detectEmotionsFromText,
  recordEmotion,
  getCharacterEmotionArc,
  runEmotionDetection,
} from './emotionTracker'
import { useEditorStore } from '@/stores/editorStore'
import { useWorldStore } from '@/stores/worldStore'
import { EMOTION_TYPES } from '@/ai/constants'

describe('emotionTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── detectEmotionsFromText ──

  describe('detectEmotionsFromText', () => {
    it('returns all zeros when character name is not mentioned in text', () => {
      const result = detectEmotionsFromText('아무 내용 없는 텍스트입니다.', '영희')
      for (const emotion of EMOTION_TYPES) {
        expect(result[emotion]).toBe(0)
      }
    })

    it('detects joy keywords and returns joy score > 0', () => {
      const text = '영희는 기쁘게 웃었다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.joy).toBeGreaterThan(0)
    })

    it('scores multiple keywords as min(10, count * 2)', () => {
      // '기쁘' + '웃' + '행복' = 3 keywords -> score = min(10, 3*2) = 6
      const text = '영희는 기쁘게 웃으며 행복했다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.joy).toBe(6)
    })

    it('caps score at 10 even with many keywords', () => {
      // 6+ joy keywords: 기쁘, 행복, 웃, 미소, 즐거, 환호 -> 6 * 2 = 12, capped at 10
      const text = '영희는 기쁘게 행복하게 웃으며 미소짓고 즐거운 환호를 보냈다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.joy).toBeLessThanOrEqual(10)
      expect(result.joy).toBe(10)
    })

    it('detects multiple emotions simultaneously', () => {
      const text = '영희는 기쁘게 웃었지만 동시에 두려움에 떨렸다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.joy).toBeGreaterThan(0)
      expect(result.fear).toBeGreaterThan(0)
    })

    it('returns 0 for emotions with no matching keywords', () => {
      const text = '영희는 기쁘게 웃었다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.sadness).toBe(0)
      expect(result.anger).toBe(0)
      expect(result.fear).toBe(0)
    })

    it('initializes all EMOTION_TYPES in the result object', () => {
      const result = detectEmotionsFromText('영희', '영희')
      for (const emotion of EMOTION_TYPES) {
        expect(result).toHaveProperty(emotion)
        expect(typeof result[emotion]).toBe('number')
      }
    })

    it('detects sadness keywords', () => {
      const text = '영희는 슬프게 눈물을 흘렸다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.sadness).toBeGreaterThan(0)
    })

    it('detects anger keywords', () => {
      const text = '영희는 분노했다. 화가 치밀어 올랐다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.anger).toBeGreaterThan(0)
    })

    it('detects fear keywords', () => {
      const text = '영희는 두려움에 떨리는 손을 감추었다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.fear).toBeGreaterThan(0)
    })

    it('detects surprise keywords', () => {
      const text = '영희는 놀라서 경악했다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.surprise).toBeGreaterThan(0)
    })

    it('detects love keywords', () => {
      const text = '영희는 사랑하는 마음에 가슴이 뛰었다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.love).toBeGreaterThan(0)
    })

    it('detects tension keywords', () => {
      const text = '영희는 긴장한 채 불안하게 기다렸다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.tension).toBeGreaterThan(0)
    })

    it('detects determination keywords', () => {
      const text = '영희는 결심했다. 반드시 해내겠다고 다짐했다.'
      const result = detectEmotionsFromText(text, '영희')
      expect(result.determination).toBeGreaterThan(0)
    })
  })

  // ── recordEmotion ──

  describe('recordEmotion', () => {
    it('calls setEmotionData on editorStore', () => {
      const mockSetEmotionData = vi.fn()
      vi.mocked(useEditorStore.getState).mockReturnValue({
        setEmotionData: mockSetEmotionData,
        emotionData: {},
      } as any)

      const emotions = { joy: 4, sadness: 0, anger: 0, fear: 0, surprise: 0, love: 0, tension: 0, determination: 0 }
      recordEmotion('char-1', 'ch-1', emotions)

      expect(mockSetEmotionData).toHaveBeenCalledTimes(1)
      expect(mockSetEmotionData).toHaveBeenCalledWith('char-1', 'ch-1', emotions)
    })
  })

  // ── getCharacterEmotionArc ──

  describe('getCharacterEmotionArc', () => {
    it('returns stored emotion data for a character', () => {
      const storedData = {
        'ch-1': { joy: 6, sadness: 2 },
        'ch-2': { joy: 0, anger: 8 },
      }
      vi.mocked(useEditorStore.getState).mockReturnValue({
        setEmotionData: vi.fn(),
        emotionData: { 'char-1': storedData },
      } as any)

      const result = getCharacterEmotionArc('char-1')
      expect(result).toEqual(storedData)
    })

    it('returns empty object when no data exists for character', () => {
      vi.mocked(useEditorStore.getState).mockReturnValue({
        setEmotionData: vi.fn(),
        emotionData: {},
      } as any)

      const result = getCharacterEmotionArc('char-nonexistent')
      expect(result).toEqual({})
    })
  })

  // ── runEmotionDetection ──

  describe('runEmotionDetection', () => {
    const mockSetEmotionData = vi.fn()

    beforeEach(() => {
      vi.mocked(useEditorStore.getState).mockReturnValue({
        setEmotionData: mockSetEmotionData,
        emotionData: {},
      } as any)
    })

    it('processes only characters mentioned in text', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        characters: [
          { id: 'char-1', name: '영희', appearance: '' },
          { id: 'char-2', name: '철수', appearance: '' },
        ],
      } as any)

      runEmotionDetection('ch-1', '영희는 기쁘게 웃었다.')

      // Only 영희 is mentioned with emotion keywords
      expect(mockSetEmotionData).toHaveBeenCalledTimes(1)
      expect(mockSetEmotionData).toHaveBeenCalledWith(
        'char-1',
        'ch-1',
        expect.objectContaining({ joy: expect.any(Number) }),
      )
    })

    it('skips characters with all-zero emotion scores', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        characters: [
          { id: 'char-1', name: '영희', appearance: '' },
        ],
      } as any)

      // Character is mentioned but no emotion keywords present
      runEmotionDetection('ch-1', '영희는 가게에 갔다.')

      expect(mockSetEmotionData).not.toHaveBeenCalled()
    })

    it('records emotions for multiple characters with non-zero scores', () => {
      vi.mocked(useWorldStore.getState).mockReturnValue({
        characters: [
          { id: 'char-1', name: '영희', appearance: '' },
          { id: 'char-2', name: '철수', appearance: '' },
        ],
      } as any)

      runEmotionDetection('ch-1', '영희는 기쁘게 웃었다. 철수는 슬프게 울었다.')

      expect(mockSetEmotionData).toHaveBeenCalledTimes(2)
      expect(mockSetEmotionData).toHaveBeenCalledWith(
        'char-1',
        'ch-1',
        expect.objectContaining({ joy: expect.any(Number) }),
      )
      expect(mockSetEmotionData).toHaveBeenCalledWith(
        'char-2',
        'ch-1',
        expect.objectContaining({ sadness: expect.any(Number) }),
      )
    })
  })
})
