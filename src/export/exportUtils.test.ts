/**
 * Unit tests for exportUtils.
 * Tests: extractPlainText, splitByCharLimit, countCharsNoSpaces, formatDialogue, downloadTextFile, formatChapterText
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  extractPlainText,
  splitByCharLimit,
  countCharsNoSpaces,
  formatDialogue,
  downloadTextFile,
  formatChapterText,
} from './exportUtils'

// ── extractPlainText ──

describe('extractPlainText', () => {
  it('should return empty string for null input', () => {
    expect(extractPlainText(null)).toBe('')
  })

  it('should return empty string for undefined input', () => {
    expect(extractPlainText(undefined)).toBe('')
  })

  it('should return the string itself when given a plain string', () => {
    expect(extractPlainText('hello world')).toBe('hello world')
  })

  it('should return empty string for content with no children', () => {
    expect(extractPlainText({ type: 'doc', content: [] })).toBe('')
  })

  it('should extract text from a text node', () => {
    expect(extractPlainText({ type: 'text', text: 'Hello' })).toBe('Hello')
  })

  it('should return empty string for a text node without text property', () => {
    expect(extractPlainText({ type: 'text' })).toBe('')
  })

  it('should extract text from a simple paragraph', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Hello world' }],
        },
      ],
    }
    expect(extractPlainText(content)).toBe('Hello world\n')
  })

  it('should extract text from multiple paragraphs', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'First paragraph' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Second paragraph' }],
        },
      ],
    }
    expect(extractPlainText(content)).toBe('First paragraph\nSecond paragraph\n')
  })

  it('should extract text from headings and add newlines', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Chapter One' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Body text here' }],
        },
      ],
    }
    expect(extractPlainText(content)).toBe('Chapter One\nBody text here\n')
  })

  it('should handle dialogueBlock and narrationBlock types', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'dialogueBlock',
          content: [{ type: 'text', text: 'Dialogue line' }],
        },
        {
          type: 'narrationBlock',
          content: [{ type: 'text', text: 'Narration line' }],
        },
      ],
    }
    expect(extractPlainText(content)).toBe('Dialogue line\nNarration line\n')
  })

  it('should handle horizontalRule', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Before' }],
        },
        { type: 'horizontalRule' },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'After' }],
        },
      ],
    }
    expect(extractPlainText(content)).toBe('Before\n\nAfter\n')
  })

  it('should handle deeply nested content', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Start ',
            },
            {
              type: 'text',
              text: 'middle ',
            },
            {
              type: 'text',
              text: 'end',
            },
          ],
        },
      ],
    }
    expect(extractPlainText(content)).toBe('Start middle end\n')
  })

  it('should handle content with no content array (non-text, non-doc node)', () => {
    expect(extractPlainText({ type: 'image' })).toBe('')
  })

  it('should handle mixed block types in a complex document', () => {
    const content = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          content: [{ type: 'text', text: 'Title' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Line A ' },
            { type: 'text', text: 'continues' },
          ],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Line B' }],
        },
      ],
    }
    expect(extractPlainText(content)).toBe('Title\nLine A continues\nLine B\n')
  })
})

// ── splitByCharLimit ──

describe('splitByCharLimit', () => {
  it('should return text in a single chunk when shorter than limit', () => {
    const result = splitByCharLimit('Short text', 100)
    expect(result).toEqual(['Short text'])
  })

  it('should return text in a single chunk when exactly at limit', () => {
    const text = 'a'.repeat(100)
    const result = splitByCharLimit(text, 100)
    expect(result).toEqual([text])
  })

  it('should split text at paragraph boundaries when exceeding limit', () => {
    const paragraph1 = 'First paragraph content.'
    const paragraph2 = 'Second paragraph content.'
    const text = `${paragraph1}\n${paragraph2}`
    // Set limit so first paragraph fits but both together do not
    const limit = paragraph1.length + 5
    const result = splitByCharLimit(text, limit)
    expect(result).toHaveLength(2)
    expect(result[0]).toBe(paragraph1)
    expect(result[1]).toBe(paragraph2)
  })

  it('should handle a single large paragraph with no break points', () => {
    const text = 'a'.repeat(200)
    const result = splitByCharLimit(text, 100)
    // Since there are no paragraph breaks, the whole text ends up in one chunk
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(text)
  })

  it('should handle empty text', () => {
    const result = splitByCharLimit('', 100)
    expect(result).toEqual([])
  })

  it('should split multiple paragraphs into correct groups', () => {
    const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4']
    const text = lines.join('\n')
    // Each line is ~6 chars + newline. Set limit to fit roughly 2 lines
    const result = splitByCharLimit(text, 14)
    expect(result.length).toBeGreaterThanOrEqual(2)
    // All original content should be present
    const joined = result.join('\n')
    for (const line of lines) {
      expect(joined).toContain(line)
    }
  })

  it('should trim chunks', () => {
    const result = splitByCharLimit('Hello\nWorld', 6)
    for (const chunk of result) {
      expect(chunk).toBe(chunk.trim())
    }
  })
})

// ── countCharsNoSpaces ──

describe('countCharsNoSpaces', () => {
  it('should count Korean characters correctly', () => {
    expect(countCharsNoSpaces('안녕하세요')).toBe(5)
  })

  it('should exclude spaces', () => {
    expect(countCharsNoSpaces('a b c')).toBe(3)
  })

  it('should exclude newlines and carriage returns', () => {
    expect(countCharsNoSpaces('a\nb\r\nc')).toBe(3)
  })

  it('should return 0 for empty string', () => {
    expect(countCharsNoSpaces('')).toBe(0)
  })

  it('should return 0 for whitespace-only string', () => {
    expect(countCharsNoSpaces('   \n\r\n  ')).toBe(0)
  })

  it('should count mixed Korean and English correctly', () => {
    expect(countCharsNoSpaces('Hello 세상')).toBe(7)
  })
})

// ── formatDialogue ──

describe('formatDialogue', () => {
  it('should normalize straight double quotes to curly quotes', () => {
    const result = formatDialogue('"Hello"')
    expect(result).toBe('\u201CHello\u201D')
  })

  it('should normalize left straight quote to left curly quote', () => {
    const result = formatDialogue('\u201CHello\u201D')
    expect(result).toBe('\u201CHello\u201D')
  })

  it('should handle text without quotes', () => {
    const result = formatDialogue('No quotes here')
    expect(result).toBe('No quotes here')
  })

  it('should handle multiple dialogue lines', () => {
    const input = '"First line"\n"Second line"'
    const result = formatDialogue(input)
    expect(result).toContain('\u201CFirst line\u201D')
    expect(result).toContain('\u201CSecond line\u201D')
  })
})

// ── formatChapterText ──

describe('formatChapterText', () => {
  it('should return empty string for chapter with no content', () => {
    const chapter = {
      id: '1', projectId: 'p1', title: 'Ch1', order: 0,
      parentId: null, type: 'chapter' as const, content: null,
      synopsis: '', wordCount: 0, createdAt: 0, updatedAt: 0,
    }
    expect(formatChapterText(chapter)).toBe('')
  })

  it('should extract and trim text from chapter content', () => {
    const chapter = {
      id: '1', projectId: 'p1', title: 'Ch1', order: 0,
      parentId: null, type: 'chapter' as const,
      content: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: '  Hello  ' }] },
        ],
      },
      synopsis: '', wordCount: 0, createdAt: 0, updatedAt: 0,
    }
    expect(formatChapterText(chapter)).toBe('Hello')
  })
})

// ── downloadTextFile ──

describe('downloadTextFile', () => {
  let mockCreateObjectURL: ReturnType<typeof vi.fn>
  let mockRevokeObjectURL: ReturnType<typeof vi.fn>
  let mockClick: ReturnType<typeof vi.fn>
  let mockAppendChild: ReturnType<typeof vi.fn>
  let mockRemoveChild: ReturnType<typeof vi.fn>
  let mockAnchor: HTMLAnchorElement

  beforeEach(() => {
    vi.useFakeTimers()
    mockCreateObjectURL = vi.fn().mockReturnValue('blob:mock-url')
    mockRevokeObjectURL = vi.fn()
    mockClick = vi.fn()
    mockAppendChild = vi.fn()
    mockRemoveChild = vi.fn()

    mockAnchor = {
      href: '',
      download: '',
      click: mockClick,
    } as unknown as HTMLAnchorElement

    vi.stubGlobal('URL', {
      createObjectURL: mockCreateObjectURL,
      revokeObjectURL: mockRevokeObjectURL,
    })

    vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor as any)
    vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild as any)
    vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('should create a blob and download it', () => {
    downloadTextFile('test content', 'output.txt')

    expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
    const blob = mockCreateObjectURL.mock.calls[0][0]
    expect(blob).toBeInstanceOf(Blob)

    expect(mockAnchor.href).toBe('blob:mock-url')
    expect(mockAnchor.download).toBe('output.txt')
    expect(mockAppendChild).toHaveBeenCalledWith(mockAnchor)
    expect(mockClick).toHaveBeenCalled()
    expect(mockRemoveChild).toHaveBeenCalledWith(mockAnchor)
  })

  it('should revoke the object URL after timeout', () => {
    downloadTextFile('content', 'file.txt')

    expect(mockRevokeObjectURL).not.toHaveBeenCalled()

    vi.advanceTimersByTime(5000)

    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url')
  })
})
