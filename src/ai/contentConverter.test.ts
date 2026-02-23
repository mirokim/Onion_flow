/**
 * Unit tests for AI contentConverter module.
 * Tests: textToTipTapContent, appendToTipTapContent, tipTapToText.
 */
import { describe, it, expect } from 'vitest'
import { textToTipTapContent, appendToTipTapContent, tipTapToText } from './contentConverter'
import type { JSONContent } from '@tiptap/react'

// ── textToTipTapContent ──

describe('textToTipTapContent', () => {
  it('returns a doc with one empty paragraph for empty string', () => {
    const result = textToTipTapContent('')
    expect(result.type).toBe('doc')
    expect(result.content).toHaveLength(1)
    expect(result.content![0].type).toBe('paragraph')
    expect(result.content![0].content![0].text).toBe('')
  })

  it('returns a doc with one empty paragraph for whitespace-only string', () => {
    const result = textToTipTapContent('   \n\n  \n  ')
    expect(result.type).toBe('doc')
    expect(result.content).toHaveLength(1)
    expect(result.content![0].type).toBe('paragraph')
    expect(result.content![0].content![0].text).toBe('')
  })

  describe('plain text paragraphs', () => {
    it('converts a single line to a paragraph', () => {
      const result = textToTipTapContent('Hello world')
      expect(result.type).toBe('doc')
      expect(result.content).toHaveLength(1)
      expect(result.content![0].type).toBe('paragraph')
      expect(result.content![0].content![0].text).toBe('Hello world')
    })

    it('converts multiple lines to multiple paragraphs', () => {
      const result = textToTipTapContent('Line one\nLine two\nLine three')
      expect(result.content).toHaveLength(3)
      expect(result.content![0].content![0].text).toBe('Line one')
      expect(result.content![1].content![0].text).toBe('Line two')
      expect(result.content![2].content![0].text).toBe('Line three')
    })

    it('skips blank lines between paragraphs', () => {
      const result = textToTipTapContent('Line one\n\nLine two')
      expect(result.content).toHaveLength(2)
      expect(result.content![0].content![0].text).toBe('Line one')
      expect(result.content![1].content![0].text).toBe('Line two')
    })
  })

  describe('headings', () => {
    it('converts "### text" to heading level 3', () => {
      const result = textToTipTapContent('### Section Three')
      expect(result.content).toHaveLength(1)
      const node = result.content![0]
      expect(node.type).toBe('heading')
      expect(node.attrs!.level).toBe(3)
      expect(node.content![0].text).toBe('Section Three')
    })

    it('converts "## text" to heading level 2', () => {
      const result = textToTipTapContent('## Section Two')
      const node = result.content![0]
      expect(node.type).toBe('heading')
      expect(node.attrs!.level).toBe(2)
      expect(node.content![0].text).toBe('Section Two')
    })

    it('converts "# text" to heading level 1', () => {
      const result = textToTipTapContent('# Section One')
      const node = result.content![0]
      expect(node.type).toBe('heading')
      expect(node.attrs!.level).toBe(1)
      expect(node.content![0].text).toBe('Section One')
    })

    it('heading priority: ### checked before ## and #', () => {
      const result = textToTipTapContent('### Not a level 1')
      expect(result.content![0].attrs!.level).toBe(3)
    })
  })

  describe('horizontal rules', () => {
    it('converts "---" to horizontalRule', () => {
      const result = textToTipTapContent('---')
      expect(result.content![0].type).toBe('horizontalRule')
    })

    it('converts "***" to horizontalRule', () => {
      const result = textToTipTapContent('***')
      expect(result.content![0].type).toBe('horizontalRule')
    })
  })

  describe('dialogue with speaker:quote patterns', () => {
    it('converts speaker:"quote" to dialogueBlock with speaker', () => {
      const result = textToTipTapContent('\u201C\uc601\ud76c: \u201C\uc548\ub155\ud558\uc138\uc694\u201D')
      // This tests the Korean-style dialogue with full-width quotes
      // Actually let's use a format that matches RE_SPEAKER_QUOTE
      const result2 = textToTipTapContent('Alice: \u201CHello there\u201D')
      expect(result2.content![0].type).toBe('dialogueBlock')
      expect(result2.content![0].attrs!.speaker).toBe('Alice')
      expect(result2.content![0].content![0].text).toBe('Hello there')
    })

    it('converts speaker with full-width colon and quotes', () => {
      const result = textToTipTapContent('\uc601\ud76c\uFF1A \u201C\uc548\ub155\ud558\uc138\uc694\u201D')
      expect(result.content![0].type).toBe('dialogueBlock')
      expect(result.content![0].attrs!.speaker).toBe('\uc601\ud76c')
      expect(result.content![0].content![0].text).toBe('\uc548\ub155\ud558\uc138\uc694')
    })

    it('converts speaker-dash pattern to dialogueBlock', () => {
      const result = textToTipTapContent('Bob - I said something')
      expect(result.content![0].type).toBe('dialogueBlock')
      expect(result.content![0].attrs!.speaker).toBe('Bob')
      expect(result.content![0].content![0].text).toBe('I said something')
    })
  })

  describe('Korean angle bracket quotes (\u300C \u300D)', () => {
    it('converts \u300Cquote\u300D to dialogueBlock', () => {
      const result = textToTipTapContent('\u300C\uc548\ub155\ud558\uc138\uc694\u300D')
      expect(result.content![0].type).toBe('dialogueBlock')
      expect(result.content![0].content![0].text).toBe('\uc548\ub155\ud558\uc138\uc694')
    })
  })

  describe('full quote lines', () => {
    it('converts a line fully wrapped in quotes to dialogueBlock without speaker', () => {
      const result = textToTipTapContent('\u201CHello world\u201D')
      expect(result.content![0].type).toBe('dialogueBlock')
      expect(result.content![0].content![0].text).toBe('Hello world')
    })

    it('detects speaker inside full quote with colon', () => {
      // "Speaker: dialogue" -> the inner colon match
      const result = textToTipTapContent('\u201CAlice: I am here\u201D')
      expect(result.content![0].type).toBe('dialogueBlock')
      expect(result.content![0].attrs!.speaker).toBe('Alice')
      expect(result.content![0].content![0].text).toBe('I am here')
    })
  })

  describe('narration blocks', () => {
    it('converts [...] to narrationBlock', () => {
      const result = textToTipTapContent('[The scene fades to black]')
      expect(result.content![0].type).toBe('narrationBlock')
      expect(result.content![0].content![0].text).toBe('The scene fades to black')
    })

    it('converts (...) to narrationBlock', () => {
      const result = textToTipTapContent('(A long silence follows)')
      expect(result.content![0].type).toBe('narrationBlock')
      expect(result.content![0].content![0].text).toBe('A long silence follows')
    })
  })

  describe('mixed content', () => {
    it('correctly parses a document with mixed node types', () => {
      const text = [
        '# Title',
        '',
        'A normal paragraph.',
        '---',
        'Alice: \u201CHello\u201D',
        '[Narration here]',
        '### Subsection',
      ].join('\n')

      const result = textToTipTapContent(text)
      expect(result.content).toHaveLength(6)
      expect(result.content![0].type).toBe('heading')
      expect(result.content![1].type).toBe('paragraph')
      expect(result.content![2].type).toBe('horizontalRule')
      expect(result.content![3].type).toBe('dialogueBlock')
      expect(result.content![4].type).toBe('narrationBlock')
      expect(result.content![5].type).toBe('heading')
    })
  })
})

// ── appendToTipTapContent ──

describe('appendToTipTapContent', () => {
  it('returns new content when existing is null', () => {
    const result = appendToTipTapContent(null, 'Hello')
    expect(result.type).toBe('doc')
    expect(result.content).toHaveLength(1)
    expect(result.content![0].type).toBe('paragraph')
    expect(result.content![0].content![0].text).toBe('Hello')
  })

  it('returns new content when existing has no content array', () => {
    const existing: JSONContent = { type: 'doc' }
    const result = appendToTipTapContent(existing, 'Hello')
    expect(result.type).toBe('doc')
    expect(result.content).toHaveLength(1)
  })

  it('merges new content after existing content', () => {
    const existing: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Existing' }] },
      ],
    }
    const result = appendToTipTapContent(existing, 'New line')
    expect(result.type).toBe('doc')
    expect(result.content).toHaveLength(2)
    expect(result.content![0].content![0].text).toBe('Existing')
    expect(result.content![1].content![0].text).toBe('New line')
  })

  it('merges multiple new nodes after existing content', () => {
    const existing: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
      ],
    }
    const result = appendToTipTapContent(existing, '# Heading\nParagraph')
    expect(result.content).toHaveLength(3)
    expect(result.content![0].content![0].text).toBe('First')
    expect(result.content![1].type).toBe('heading')
    expect(result.content![2].type).toBe('paragraph')
  })
})

// ── tipTapToText ──

describe('tipTapToText', () => {
  it('returns empty string for null content', () => {
    expect(tipTapToText(null)).toBe('')
  })

  it('returns empty string for content without content array', () => {
    expect(tipTapToText({ type: 'doc' })).toBe('')
  })

  it('converts paragraphs to plain text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'World' }] },
      ],
    }
    expect(tipTapToText(doc)).toBe('Hello\nWorld')
  })

  it('converts heading to prefixed text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] },
      ],
    }
    expect(tipTapToText(doc)).toBe('## Title')
  })

  it('converts heading level 1', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Big Title' }] },
      ],
    }
    expect(tipTapToText(doc)).toBe('# Big Title')
  })

  it('converts heading level 3', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Sub' }] },
      ],
    }
    expect(tipTapToText(doc)).toBe('### Sub')
  })

  it('defaults heading level to 1 when attrs missing', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', content: [{ type: 'text', text: 'NoLevel' }] },
      ],
    }
    expect(tipTapToText(doc)).toBe('# NoLevel')
  })

  it('converts horizontalRule to "---"', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [{ type: 'horizontalRule' }],
    }
    expect(tipTapToText(doc)).toBe('---')
  })

  it('converts dialogueBlock with speaker to formatted dialogue', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'dialogueBlock', attrs: { speaker: 'Alice' }, content: [{ type: 'text', text: 'Hello' }] },
      ],
    }
    expect(tipTapToText(doc)).toBe('Alice: "Hello"')
  })

  it('converts dialogueBlock without speaker to quoted text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'dialogueBlock', content: [{ type: 'text', text: 'Some dialogue' }] },
      ],
    }
    expect(tipTapToText(doc)).toBe('"Some dialogue"')
  })

  it('converts narrationBlock to parenthesized text', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'narrationBlock', content: [{ type: 'text', text: 'He walked away' }] },
      ],
    }
    expect(tipTapToText(doc)).toBe('(He walked away)')
  })

  it('handles mixed content types', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Chapter' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Intro text' }] },
        { type: 'dialogueBlock', attrs: { speaker: 'Bob' }, content: [{ type: 'text', text: 'Hi' }] },
        { type: 'narrationBlock', content: [{ type: 'text', text: 'Pause' }] },
        { type: 'horizontalRule' },
      ],
    }
    expect(tipTapToText(doc)).toBe('# Chapter\nIntro text\nBob: "Hi"\n(Pause)\n---')
  })

  it('handles nodes with empty content arrays', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [] },
      ],
    }
    expect(tipTapToText(doc)).toBe('')
  })

  it('handles nodes with no content property', () => {
    const doc: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph' },
      ],
    }
    expect(tipTapToText(doc)).toBe('')
  })
})

// ── Round-trip ──

describe('round-trip: textToTipTapContent -> tipTapToText', () => {
  it('preserves plain paragraph text', () => {
    const original = 'Hello world'
    expect(tipTapToText(textToTipTapContent(original))).toBe(original)
  })

  it('preserves headings', () => {
    const original = '## My Heading'
    expect(tipTapToText(textToTipTapContent(original))).toBe(original)
  })

  it('preserves horizontal rules', () => {
    expect(tipTapToText(textToTipTapContent('---'))).toBe('---')
  })

  it('preserves narration blocks with round brackets', () => {
    const original = '(Narration text here)'
    const result = tipTapToText(textToTipTapContent(original))
    expect(result).toBe('(Narration text here)')
  })
})
