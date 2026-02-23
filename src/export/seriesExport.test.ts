/**
 * Unit tests for seriesExport.
 * Tests: exportForSeries with mobile formatting, splitting, and custom maxChars.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Chapter } from '@/types'

// ── Mock dependencies ──

vi.mock('./exportUtils', () => ({
  formatChapterText: vi.fn(),
  splitByCharLimit: vi.fn(),
  downloadTextFile: vi.fn(),
}))

vi.mock('@/lib/dateUtils', () => ({
  nowUTC: vi.fn(() => 1700000000),
}))

import { exportForSeries } from './seriesExport'
import { formatChapterText, splitByCharLimit, downloadTextFile } from './exportUtils'

const mockFormatChapterText = vi.mocked(formatChapterText)
const mockSplitByCharLimit = vi.mocked(splitByCharLimit)
const mockDownloadTextFile = vi.mocked(downloadTextFile)

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'ch-1',
    projectId: 'proj-1',
    title: 'Chapter 1',
    order: 1,
    parentId: null,
    type: 'chapter',
    content: null,
    synopsis: '',
    wordCount: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('exportForSeries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should filter out non-chapter types', () => {
    const chapters = [
      makeChapter({ id: 'v1', type: 'volume', title: 'Volume', order: 0 }),
      makeChapter({ id: 'ch1', type: 'chapter', title: 'Ch 1', order: 1 }),
    ]
    mockFormatChapterText.mockReturnValueOnce('Chapter content')

    exportForSeries(chapters)

    expect(mockFormatChapterText).toHaveBeenCalledTimes(1)
  })

  it('should skip chapters with empty text', () => {
    const chapters = [
      makeChapter({ id: 'ch1', title: 'Empty', order: 1 }),
      makeChapter({ id: 'ch2', title: 'Full', order: 2 }),
    ]
    mockFormatChapterText.mockReturnValueOnce('')
    mockFormatChapterText.mockReturnValueOnce('Some content')

    exportForSeries(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).not.toContain('Empty')
    expect(output).toContain('[Full]')
  })

  it('should not split chapters under 6000 chars (default maxChars)', () => {
    const shortText = 'Line one\nLine two'
    const chapters = [makeChapter({ id: 'ch1', title: 'Short', order: 1 })]
    mockFormatChapterText.mockReturnValue(shortText)

    exportForSeries(chapters)

    expect(mockSplitByCharLimit).not.toHaveBeenCalled()
    expect(mockDownloadTextFile).toHaveBeenCalledTimes(1)
    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).toContain('[Short]')
  })

  it('should split chapters over 6000 chars', () => {
    // formatForMobile will double line breaks, making text longer
    const longText = ('Line content\n').repeat(500)
    const chapters = [makeChapter({ id: 'ch1', title: 'Long Chapter', order: 1 })]
    mockFormatChapterText.mockReturnValue(longText)
    mockSplitByCharLimit.mockReturnValue(['Part A', 'Part B', 'Part C'])

    exportForSeries(chapters)

    expect(mockSplitByCharLimit).toHaveBeenCalled()
    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).toContain('[Long Chapter (1/3)]')
    expect(output).toContain('[Long Chapter (2/3)]')
    expect(output).toContain('[Long Chapter (3/3)]')
  })

  it('should use custom maxChars parameter', () => {
    const text = 'a'.repeat(3000)
    const chapters = [makeChapter({ id: 'ch1', title: 'Custom', order: 1 })]
    mockFormatChapterText.mockReturnValue(text)
    mockSplitByCharLimit.mockReturnValue(['Part 1', 'Part 2'])

    exportForSeries(chapters, 2000)

    expect(mockSplitByCharLimit).toHaveBeenCalled()
    // splitByCharLimit should be called with custom limit
    expect(mockSplitByCharLimit.mock.calls[0][1]).toBe(2000)
  })

  it('should skip splitting when maxChars is 0 or negative', () => {
    const longText = 'a'.repeat(10000)
    const chapters = [makeChapter({ id: 'ch1', title: 'NoSplit', order: 1 })]
    mockFormatChapterText.mockReturnValue(longText)

    exportForSeries(chapters, 0)

    expect(mockSplitByCharLimit).not.toHaveBeenCalled()
  })

  it('should apply mobile formatting (double line breaks)', () => {
    const text = 'Line 1\nLine 2\nLine 3'
    const chapters = [makeChapter({ id: 'ch1', title: 'Mobile', order: 1 })]
    mockFormatChapterText.mockReturnValue(text)

    exportForSeries(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    // formatForMobile converts single newlines to double
    expect(output).toContain('Line 1\n\nLine 2\n\nLine 3')
  })

  it('should not produce quadruple blank lines', () => {
    // Text with existing double newlines - formatForMobile should not make them quadruple
    const text = 'Paragraph 1\n\nParagraph 2'
    const chapters = [makeChapter({ id: 'ch1', title: 'NoQuad', order: 1 })]
    mockFormatChapterText.mockReturnValue(text)

    exportForSeries(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).not.toContain('\n\n\n\n')
  })

  it('should trim trailing whitespace from lines', () => {
    const text = 'Line with spaces   \nAnother line   '
    const chapters = [makeChapter({ id: 'ch1', title: 'Trimmed', order: 1 })]
    mockFormatChapterText.mockReturnValue(text)

    exportForSeries(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).not.toContain('spaces   ')
  })

  it('should sort chapters by order', () => {
    const chapters = [
      makeChapter({ id: 'ch3', title: 'Third', order: 3 }),
      makeChapter({ id: 'ch1', title: 'First', order: 1 }),
    ]
    mockFormatChapterText.mockReturnValueOnce('Content C')
    mockFormatChapterText.mockReturnValueOnce('Content A')

    exportForSeries(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    const firstIdx = output.indexOf('[First]')
    const thirdIdx = output.indexOf('[Third]')
    expect(firstIdx).toBeLessThan(thirdIdx)
  })

  it('should use heavy horizontal line separator', () => {
    const chapters = [
      makeChapter({ id: 'ch1', title: 'Ch1', order: 1 }),
      makeChapter({ id: 'ch2', title: 'Ch2', order: 2 }),
    ]
    mockFormatChapterText.mockReturnValueOnce('Content 1')
    mockFormatChapterText.mockReturnValueOnce('Content 2')

    exportForSeries(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).toContain('\u2501'.repeat(30))
  })

  it('should generate correct filename', () => {
    const chapters = [makeChapter({ id: 'ch1', title: 'Test', order: 1 })]
    mockFormatChapterText.mockReturnValue('Content')

    exportForSeries(chapters)

    expect(mockDownloadTextFile).toHaveBeenCalledWith(
      expect.any(String),
      'manuscript_series_1700000000.txt',
    )
  })
})
