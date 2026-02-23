/**
 * Unit tests for detectorManager.
 * Tests: runAllDetectors(), scheduleDetectorRun(), cancelDetectorRun()
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('./emotionTracker', () => ({
  runEmotionDetection: vi.fn(),
}))
vi.mock('./foreshadowDetector', () => ({
  detectForeshadowMentions: vi.fn(() => []),
  detectItemMentions: vi.fn(() => []),
}))
vi.mock('./conflictDefense', () => ({
  detectConflicts: vi.fn(() => []),
}))

import { runAllDetectors, scheduleDetectorRun, cancelDetectorRun } from './detectorManager'
import { runEmotionDetection } from './emotionTracker'
import { detectForeshadowMentions, detectItemMentions } from './foreshadowDetector'
import { detectConflicts } from './conflictDefense'

describe('detectorManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(detectForeshadowMentions).mockReturnValue([])
    vi.mocked(detectItemMentions).mockReturnValue([])
    vi.mocked(detectConflicts).mockReturnValue([])
    vi.useFakeTimers()
  })

  afterEach(() => {
    cancelDetectorRun()
    vi.useRealTimers()
  })

  // ── runAllDetectors ──

  describe('runAllDetectors', () => {
    it('calls all detector functions', () => {
      runAllDetectors('ch-1', '테스트 텍스트')

      expect(runEmotionDetection).toHaveBeenCalledWith('ch-1', '테스트 텍스트')
      expect(detectForeshadowMentions).toHaveBeenCalledWith('테스트 텍스트')
      expect(detectItemMentions).toHaveBeenCalledWith('테스트 텍스트')
      expect(detectConflicts).toHaveBeenCalledWith('테스트 텍스트')
    })

    it('returns aggregated results from all detectors', () => {
      vi.mocked(detectForeshadowMentions).mockReturnValue([
        { foreshadowId: 'fs-1', title: '예언', matchedText: '예언', position: 0 },
      ])
      vi.mocked(detectItemMentions).mockReturnValue([
        { itemId: 'item-1', itemName: '검', context: 'mentioned', position: 5 },
        { itemId: 'item-2', itemName: '방패', context: 'acquired', position: 10 },
      ])
      vi.mocked(detectConflicts).mockReturnValue([
        {
          type: 'character',
          entityName: '영희',
          conflictDescription: '외모 불일치',
          textExcerpt: '영희는 금발 머리...',
          position: 0,
          severity: 'warning',
        },
      ])

      const result = runAllDetectors('ch-1', '텍스트')
      expect(result.emotions).toBe(true)
      expect(result.foreshadows).toBe(1)
      expect(result.items).toBe(2)
      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].entityName).toBe('영희')
    })

    it('returns zero counts when no matches found', () => {
      const result = runAllDetectors('ch-1', '빈 텍스트')
      expect(result).toEqual({
        emotions: true,
        foreshadows: 0,
        items: 0,
        conflicts: [],
      })
    })
  })

  // ── scheduleDetectorRun ──

  describe('scheduleDetectorRun', () => {
    it('debounces execution by 3000ms', () => {
      scheduleDetectorRun('ch-1', '텍스트')

      // Not executed before 3000ms
      vi.advanceTimersByTime(2999)
      expect(runEmotionDetection).not.toHaveBeenCalled()

      // Executed at 3000ms
      vi.advanceTimersByTime(1)
      expect(runEmotionDetection).toHaveBeenCalledWith('ch-1', '텍스트')
    })

    it('invokes callback with results after debounce', () => {
      const callback = vi.fn()
      scheduleDetectorRun('ch-1', '텍스트', callback)

      vi.advanceTimersByTime(3000)

      expect(callback).toHaveBeenCalledTimes(1)
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          emotions: true,
          foreshadows: 0,
          items: 0,
          conflicts: [],
        }),
      )
    })

    it('only executes the last call when called multiple times', () => {
      scheduleDetectorRun('ch-1', '첫 번째 텍스트')
      vi.advanceTimersByTime(1000)

      scheduleDetectorRun('ch-1', '두 번째 텍스트')
      vi.advanceTimersByTime(3000)

      // Only the second call should have been executed
      expect(runEmotionDetection).toHaveBeenCalledTimes(1)
      expect(runEmotionDetection).toHaveBeenCalledWith('ch-1', '두 번째 텍스트')
    })

    it('does not run detectors immediately', () => {
      scheduleDetectorRun('ch-1', '텍스트')
      expect(runEmotionDetection).not.toHaveBeenCalled()
    })
  })

  // ── cancelDetectorRun ──

  describe('cancelDetectorRun', () => {
    it('clears pending timer and prevents execution', () => {
      scheduleDetectorRun('ch-1', '텍스트')
      cancelDetectorRun()

      vi.advanceTimersByTime(5000)

      expect(runEmotionDetection).not.toHaveBeenCalled()
    })

    it('does not throw when called with no pending run', () => {
      expect(() => cancelDetectorRun()).not.toThrow()
    })
  })
})
