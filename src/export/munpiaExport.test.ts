/**
 * Unit tests for munpiaExport.
 * Tests: exportForMunpia with formatting, splitting, and empty chapter filtering.
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

import { exportForMunpia } from './munpiaExport'
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

describe('exportForMunpia', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('should filter out non-chapter types (e.g., volumes)', () => {
    const chapters = [
      makeChapter({ id: 'v1', type: 'volume', title: 'Volume 1', order: 0 }),
      makeChapter({ id: 'ch1', type: 'chapter', title: 'Ch 1', order: 1 }),
    ]
    mockFormatChapterText.mockReturnValueOnce('') // volume (filtered by type, won't be called)
    mockFormatChapterText.mockReturnValueOnce('Chapter content')

    exportForMunpia(chapters)

    // Volume should be filtered out, only chapter processed
    expect(mockFormatChapterText).toHaveBeenCalledTimes(1)
  })

  it('should skip chapters with empty text', () => {
    const chapters = [
      makeChapter({ id: 'ch1', title: 'Empty Chapter', order: 1 }),
      makeChapter({ id: 'ch2', title: 'Full Chapter', order: 2 }),
    ]
    mockFormatChapterText.mockReturnValueOnce('')
    mockFormatChapterText.mockReturnValueOnce('Some content here')

    exportForMunpia(chapters)

    expect(mockDownloadTextFile).toHaveBeenCalledTimes(1)
    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).not.toContain('Empty Chapter')
    expect(output).toContain('[Full Chapter]')
  })

  it('should not split chapters under 5500 chars', () => {
    const shortText = 'a'.repeat(5000)
    const chapters = [makeChapter({ id: 'ch1', title: 'Short', order: 1 })]
    mockFormatChapterText.mockReturnValue(shortText)

    exportForMunpia(chapters)

    expect(mockSplitByCharLimit).not.toHaveBeenCalled()
    expect(mockDownloadTextFile).toHaveBeenCalledTimes(1)
    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).toContain('[Short]')
    expect(output).toContain(shortText)
  })

  it('should split chapters over 5500 chars into parts', () => {
    const longText = 'a'.repeat(6000)
    const chapters = [makeChapter({ id: 'ch1', title: 'Long Chapter', order: 1 })]
    mockFormatChapterText.mockReturnValue(longText)
    mockSplitByCharLimit.mockReturnValue(['Part one text', 'Part two text'])

    exportForMunpia(chapters)

    expect(mockSplitByCharLimit).toHaveBeenCalledWith(longText, 5500)
    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).toContain('[Long Chapter (1/2)]')
    expect(output).toContain('[Long Chapter (2/2)]')
    expect(output).toContain('Part one text')
    expect(output).toContain('Part two text')
  })

  it('should format text by removing excessive blank lines', () => {
    const textWithExcessiveBlankLines = 'Line 1\n\n\n\n\nLine 2'
    const chapters = [makeChapter({ id: 'ch1', title: 'Test', order: 1 })]
    mockFormatChapterText.mockReturnValue(textWithExcessiveBlankLines)

    exportForMunpia(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    // formatMunpia reduces \n{3+} to \n\n
    expect(output).not.toContain('\n\n\n')
  })

  it('should trim trailing whitespace on each line', () => {
    const textWithTrailingSpaces = 'Line 1   \nLine 2   '
    const chapters = [makeChapter({ id: 'ch1', title: 'Trimmed', order: 1 })]
    mockFormatChapterText.mockReturnValue(textWithTrailingSpaces)

    exportForMunpia(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).toContain('Line 1\nLine 2')
    expect(output).not.toContain('Line 1   ')
  })

  it('should sort chapters by order', () => {
    const chapters = [
      makeChapter({ id: 'ch2', title: 'Second', order: 2 }),
      makeChapter({ id: 'ch1', title: 'First', order: 1 }),
    ]
    mockFormatChapterText.mockReturnValueOnce('Content B')
    mockFormatChapterText.mockReturnValueOnce('Content A')

    exportForMunpia(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    const firstPos = output.indexOf('[First]')
    const secondPos = output.indexOf('[Second]')
    // The mock returns are consumed in call order, but chapters are sorted
    // so formatChapterText is called first for 'First' then 'Second'
    expect(firstPos).toBeLessThan(secondPos)
  })

  it('should use separator between chapters', () => {
    const chapters = [
      makeChapter({ id: 'ch1', title: 'Ch1', order: 1 }),
      makeChapter({ id: 'ch2', title: 'Ch2', order: 2 }),
    ]
    mockFormatChapterText.mockReturnValueOnce('Content 1')
    mockFormatChapterText.mockReturnValueOnce('Content 2')

    exportForMunpia(chapters)

    const output = mockDownloadTextFile.mock.calls[0][0]
    expect(output).toContain('\u2500'.repeat(40))
  })

  it('should generate correct filename', () => {
    const chapters = [makeChapter({ id: 'ch1', title: 'Test', order: 1 })]
    mockFormatChapterText.mockReturnValue('Content')

    exportForMunpia(chapters)

    expect(mockDownloadTextFile).toHaveBeenCalledWith(
      expect.any(String),
      'manuscript_munpia_1700000000.txt',
    )
  })
})
