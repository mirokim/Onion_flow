/**
 * Unit tests for projectSerializer module.
 * Tests: saveProjectToFolder, loadProjectFromFolder, and indirectly
 * jsonContentToMarkdown, chaptersToMarkdown, wikiEntriesToMarkdown.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/dateUtils', () => ({
  nowUTC: vi.fn(() => 1700000000000),
}))

import { saveProjectToFolder, loadProjectFromFolder } from '@/db/projectSerializer'
import type { Project, Chapter, CanvasNode, CanvasWire, WikiEntry } from '@/types'

// ── Mocks ──

const mockWriteProjectFile = vi.fn<(path: string, filename: string, content: string) => Promise<void>>(async () => {})
const mockReadProjectFile = vi.fn<(path: string, filename: string) => Promise<{ success: boolean; data?: string }>>()

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).electronAPI = {
    writeProjectFile: mockWriteProjectFile,
    readProjectFile: mockReadProjectFile,
  }
})

afterEach(() => {
  delete (window as any).electronAPI
})

// ── Helpers ──

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    title: 'Test Novel',
    description: 'A test project',
    genre: 'Fantasy',
    synopsis: 'A hero embarks on a quest.',
    settings: { language: 'en', targetDailyWords: 1000, readingSpeedCPM: 500 },
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  }
}

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: 'ch-1',
    projectId: 'proj-1',
    title: 'Chapter One',
    order: 0,
    parentId: null,
    type: 'chapter',
    content: null,
    synopsis: '',
    wordCount: 0,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  }
}

function makeWikiEntry(overrides: Partial<WikiEntry> = {}): WikiEntry {
  return {
    id: 'wiki-1',
    projectId: 'proj-1',
    category: 'character',
    title: 'Hero',
    content: 'The main character.',
    tags: [],
    order: 0,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    ...overrides,
  }
}

const emptyNodes: CanvasNode[] = []
const emptyWires: CanvasWire[] = []

describe('projectSerializer', () => {
  // ── saveProjectToFolder ──

  describe('saveProjectToFolder', () => {
    it('should write project.json with correct metadata', async () => {
      const project = makeProject()
      const result = await saveProjectToFolder('/test/path', project, [], emptyNodes, emptyWires, [])

      expect(result.success).toBe(true)

      const projectJsonCall = mockWriteProjectFile.mock.calls.find(
        (call) => call[1] === 'project.json',
      )
      expect(projectJsonCall).toBeDefined()

      const written = JSON.parse(projectJsonCall![2])
      expect(written.id).toBe('proj-1')
      expect(written.title).toBe('Test Novel')
      expect(written.description).toBe('A test project')
      expect(written.genre).toBe('Fantasy')
      expect(written.updatedAt).toBe(1700000000000)
    })

    it('should write canvas.json with nodes and wires', async () => {
      const nodes: CanvasNode[] = [
        {
          id: 'node-1',
          projectId: 'proj-1',
          parentCanvasId: null,
          type: 'chapter',
          position: { x: 100, y: 200 },
          data: { chapterId: 'ch-1' },
          createdAt: 1700000000000,
          updatedAt: 1700000000000,
        },
      ]
      const wires: CanvasWire[] = [
        {
          id: 'wire-1',
          projectId: 'proj-1',
          parentCanvasId: null,
          sourceNodeId: 'node-1',
          targetNodeId: 'node-2',
          sourceHandle: 'bottom',
          targetHandle: 'top',
        },
      ]

      await saveProjectToFolder('/test/path', makeProject(), [], nodes, wires, [])

      const canvasCall = mockWriteProjectFile.mock.calls.find(
        (call) => call[1] === 'canvas.json',
      )
      expect(canvasCall).toBeDefined()

      const canvasData = JSON.parse(canvasCall![2])
      expect(canvasData.nodes).toHaveLength(1)
      expect(canvasData.nodes[0].id).toBe('node-1')
      expect(canvasData.wires).toHaveLength(1)
      expect(canvasData.wires[0].id).toBe('wire-1')
    })

    it('should write manuscript.md with chapter markdown', async () => {
      const chapters: Chapter[] = [
        makeChapter({
          title: 'The Beginning',
          synopsis: 'It all starts here.',
          content: {
            type: 'doc',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'Once upon a time.' }] },
            ],
          },
        }),
      ]

      await saveProjectToFolder('/test/path', makeProject(), chapters, emptyNodes, emptyWires, [])

      const manuscriptCall = mockWriteProjectFile.mock.calls.find(
        (call) => call[1] === 'manuscript.md',
      )
      expect(manuscriptCall).toBeDefined()

      const md = manuscriptCall![2] as string
      expect(md).toContain('## The Beginning')
      expect(md).toContain('> It all starts here.')
      expect(md).toContain('Once upon a time.')
    })

    it('should write wiki.md with wiki entry markdown', async () => {
      const wikiEntries: WikiEntry[] = [
        makeWikiEntry({ category: 'character', title: 'Hero', content: 'Brave warrior', tags: ['main'] }),
      ]

      await saveProjectToFolder('/test/path', makeProject(), [], emptyNodes, emptyWires, wikiEntries)

      const wikiCall = mockWriteProjectFile.mock.calls.find(
        (call) => call[1] === 'wiki.md',
      )
      expect(wikiCall).toBeDefined()

      const md = wikiCall![2] as string
      expect(md).toContain('## character')
      expect(md).toContain('### Hero')
      expect(md).toContain('Brave warrior')
      expect(md).toContain('Tags: main')
    })

    it('should return { success: false } when electronAPI is not available', async () => {
      delete (window as any).electronAPI

      const result = await saveProjectToFolder('/test/path', makeProject(), [], emptyNodes, emptyWires, [])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Electron API not available')
    })

    it('should return error on write failure', async () => {
      mockWriteProjectFile.mockRejectedValueOnce(new Error('Disk full'))

      const result = await saveProjectToFolder('/test/path', makeProject(), [], emptyNodes, emptyWires, [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Disk full')
    })
  })

  // ── loadProjectFromFolder ──

  describe('loadProjectFromFolder', () => {
    it('should read and parse project.json', async () => {
      const projectData = { id: 'proj-1', title: 'My Novel' }
      mockReadProjectFile
        .mockResolvedValueOnce({ success: true, data: JSON.stringify(projectData) }) // project.json
        .mockResolvedValueOnce({ success: true, data: JSON.stringify({ nodes: [], wires: [] }) }) // canvas.json

      const result = await loadProjectFromFolder('/test/path')

      expect(result.success).toBe(true)
      expect(result.project).toEqual(projectData)
    })

    it('should read canvas.json with nodes and wires', async () => {
      const canvasData = {
        nodes: [{ id: 'n1', type: 'chapter' }],
        wires: [{ id: 'w1', sourceNodeId: 'n1', targetNodeId: 'n2' }],
      }
      mockReadProjectFile
        .mockResolvedValueOnce({ success: true, data: JSON.stringify({ id: 'proj-1' }) })
        .mockResolvedValueOnce({ success: true, data: JSON.stringify(canvasData) })

      const result = await loadProjectFromFolder('/test/path')

      expect(result.success).toBe(true)
      expect(result.canvasNodes).toHaveLength(1)
      expect(result.canvasNodes![0].id).toBe('n1')
      expect(result.canvasWires).toHaveLength(1)
      expect(result.canvasWires![0].id).toBe('w1')
    })

    it('should return error when electronAPI is not available', async () => {
      delete (window as any).electronAPI

      const result = await loadProjectFromFolder('/test/path')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Electron API not available')
    })

    it('should return error when project.json is not found', async () => {
      mockReadProjectFile.mockResolvedValueOnce({ success: false, data: undefined })

      const result = await loadProjectFromFolder('/test/path')

      expect(result.success).toBe(false)
      expect(result.error).toContain('project.json not found')
    })
  })

  // ── Indirect jsonContentToMarkdown tests (via manuscript.md output) ──

  describe('jsonContentToMarkdown (via manuscript.md)', () => {
    /** Helper: save a single chapter with given content, return the manuscript.md string */
    async function getManuscriptMd(content: any, chapterOverrides: Partial<Chapter> = {}): Promise<string> {
      const chapter = makeChapter({ content, ...chapterOverrides })
      await saveProjectToFolder('/test', makeProject(), [chapter], emptyNodes, emptyWires, [])
      const call = mockWriteProjectFile.mock.calls.find((c) => c[1] === 'manuscript.md')
      return call![2] as string
    }

    it('should convert paragraphs to plain text lines', async () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'First paragraph.' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Second paragraph.' }] },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('First paragraph.')
      expect(md).toContain('Second paragraph.')
    })

    it('should convert heading level 1 to # prefix', async () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Main Title' }] },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('# Main Title')
    })

    it('should convert heading level 2 to ## prefix', async () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Subtitle' }] },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('## Subtitle')
    })

    it('should convert heading level 3 to ### prefix', async () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Section' }] },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('### Section')
    })

    it('should convert bold text to **text**', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'important', marks: [{ type: 'bold' }] },
            ],
          },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('**important**')
    })

    it('should convert italic text to *text*', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'emphasis', marks: [{ type: 'italic' }] },
            ],
          },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('*emphasis*')
    })

    it('should convert code text to `text`', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'variable', marks: [{ type: 'code' }] },
            ],
          },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('`variable`')
    })

    it('should convert bullet lists to - item', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Apple' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Banana' }] }] },
            ],
          },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('- Apple')
      expect(md).toContain('- Banana')
    })

    it('should convert ordered lists to 1. item', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'orderedList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] },
            ],
          },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('1. First')
      expect(md).toContain('2. Second')
    })

    it('should convert blockquotes to > text', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [
              { type: 'paragraph', content: [{ type: 'text', text: 'A wise saying.' }] },
            ],
          },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('> A wise saying.')
    })

    it('should convert code blocks to triple backtick wrapper', async () => {
      const content = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            content: [{ type: 'text', text: 'const x = 1' }],
          },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('```')
      expect(md).toContain('const x = 1')
    })

    it('should convert horizontal rules to ---', async () => {
      const content = {
        type: 'doc',
        content: [
          { type: 'horizontalRule' },
        ],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('---')
    })

    it('should handle null content as empty string', async () => {
      const md = await getManuscriptMd(null)
      // The chapter heading is still there, but no body content
      expect(md).toContain('## Chapter One')
      // After the heading + separator, there should be no extra body content
    })

    it('should handle empty content as empty string', async () => {
      const md = await getManuscriptMd({ type: 'doc', content: [] })
      expect(md).toContain('## Chapter One')
    })

    it('should render chapter synopsis as > synopsis', async () => {
      const md = await getManuscriptMd(null, { synopsis: 'A brief summary.' })
      expect(md).toContain('> A brief summary.')
    })

    it('should render volume as # heading and chapter as ## heading', async () => {
      const volume = makeChapter({ id: 'vol-1', title: 'Volume 1', type: 'volume', order: 0, parentId: null })
      const chapter = makeChapter({ id: 'ch-1', title: 'Chapter 1', type: 'chapter', order: 1, parentId: 'vol-1' })

      await saveProjectToFolder('/test', makeProject(), [volume, chapter], emptyNodes, emptyWires, [])

      const call = mockWriteProjectFile.mock.calls.find((c) => c[1] === 'manuscript.md')
      const md = call![2] as string

      // Volume uses # (single hash)
      expect(md).toMatch(/^# Volume 1$/m)
      // Chapter uses ## (double hash)
      expect(md).toMatch(/^## Chapter 1$/m)
    })
  })
})
