/**
 * Unit tests for projectSerializer module.
 * Tests: saveProjectToFolder, loadProjectFromFolder, and indirectly
 * jsonContentToMarkdown, chaptersToMarkdown, wikiEntriesToMarkdown.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/dateUtils', () => ({
  nowUTC: vi.fn(() => 1700000000000),
}))

import { saveProjectToFolder, loadProjectFromFolder } from '@/db/projectSerializer'
import type { FileWriterHandle } from '@/db/fileWriter'
import type { Project, Chapter, CanvasNode, CanvasWire, WikiEntry } from '@/types'

// ── Mock FileWriterHandle ──

function createMockWriter(files: Record<string, string> = {}): FileWriterHandle & { written: Record<string, string> } {
  const written: Record<string, string> = {}
  return {
    written,
    async writeFile(filename: string, content: string) {
      written[filename] = content
    },
    async readFile(filename: string): Promise<string | null> {
      return files[filename] ?? written[filename] ?? null
    },
    isAvailable() { return true },
  }
}

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
const emptyWorld = {
  characters: [],
  relations: [],
  worldSettings: [],
  items: [],
  foreshadows: [],
  referenceData: [],
}

function makeSaveParams(overrides: any = {}) {
  return {
    project: makeProject(),
    chapters: [] as Chapter[],
    canvasNodes: emptyNodes,
    canvasWires: emptyWires,
    wikiEntries: [] as WikiEntry[],
    ...emptyWorld,
    ...overrides,
  }
}

describe('projectSerializer', () => {
  // ── saveProjectToFolder ──

  describe('saveProjectToFolder', () => {
    it('should write storyflow.json with correct structure', async () => {
      const writer = createMockWriter()
      const result = await saveProjectToFolder(writer, makeSaveParams())

      expect(result.success).toBe(true)
      expect(writer.written['storyflow.json']).toBeDefined()

      const data = JSON.parse(writer.written['storyflow.json'])
      expect(data.version).toBe(1)
      expect(data.project.id).toBe('proj-1')
      expect(data.project.title).toBe('Test Novel')
      expect(data.canvas.nodes).toEqual([])
      expect(data.canvas.wires).toEqual([])
      expect(data.world.characters).toEqual([])
      expect(data.chapters).toEqual([])
      expect(data.wikiEntries).toEqual([])
    })

    it('should write storyflow.json with canvas nodes and wires', async () => {
      const writer = createMockWriter()
      const nodes: CanvasNode[] = [{
        id: 'node-1', projectId: 'proj-1', parentCanvasId: null,
        type: 'character', position: { x: 100, y: 200 }, data: {},
        createdAt: 1700000000000, updatedAt: 1700000000000,
      }]
      const wires: CanvasWire[] = [{
        id: 'wire-1', projectId: 'proj-1', parentCanvasId: null,
        sourceNodeId: 'node-1', targetNodeId: 'node-2',
        sourceHandle: 'out', targetHandle: 'in',
      }]

      await saveProjectToFolder(writer, makeSaveParams({ canvasNodes: nodes, canvasWires: wires }))

      const data = JSON.parse(writer.written['storyflow.json'])
      expect(data.canvas.nodes).toHaveLength(1)
      expect(data.canvas.nodes[0].id).toBe('node-1')
      expect(data.canvas.wires).toHaveLength(1)
      expect(data.canvas.wires[0].id).toBe('wire-1')
    })

    it('should write manuscript.md with chapter markdown', async () => {
      const writer = createMockWriter()
      const chapters: Chapter[] = [
        makeChapter({
          title: 'The Beginning',
          synopsis: 'It all starts here.',
          content: {
            type: 'doc',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Once upon a time.' }] }],
          },
        }),
      ]

      await saveProjectToFolder(writer, makeSaveParams({ chapters }))

      const md = writer.written['manuscript.md']
      expect(md).toContain('## The Beginning')
      expect(md).toContain('> It all starts here.')
      expect(md).toContain('Once upon a time.')
    })

    it('should write wiki.md with wiki entry markdown', async () => {
      const writer = createMockWriter()
      const wikiEntries: WikiEntry[] = [
        makeWikiEntry({ category: 'character', title: 'Hero', content: 'Brave warrior', tags: ['main'] }),
      ]

      await saveProjectToFolder(writer, makeSaveParams({ wikiEntries }))

      const md = writer.written['wiki.md']
      expect(md).toContain('## character')
      expect(md).toContain('### Hero')
      expect(md).toContain('Brave warrior')
      expect(md).toContain('Tags: main')
    })

    it('should return error on write failure', async () => {
      const writer: FileWriterHandle = {
        async writeFile() { throw new Error('Disk full') },
        async readFile() { return null },
        isAvailable() { return true },
      }

      const result = await saveProjectToFolder(writer, makeSaveParams())

      expect(result.success).toBe(false)
      expect(result.error).toBe('Disk full')
    })
  })

  // ── loadProjectFromFolder ──

  describe('loadProjectFromFolder', () => {
    it('should load from storyflow.json (new format)', async () => {
      const storyflow = {
        version: 1,
        project: { id: 'proj-1', title: 'My Novel', description: '', genre: '', synopsis: '', settings: { language: 'ko', targetDailyWords: 3000, readingSpeedCPM: 500 }, createdAt: 1700000000000, updatedAt: 1700000000000 },
        canvas: { nodes: [{ id: 'n1' }], wires: [] },
        world: { characters: [], relations: [], worldSettings: [], items: [], foreshadows: [], referenceData: [] },
        chapters: [{ id: 'ch-1', title: 'Chapter 1' }],
        wikiEntries: [],
      }
      const writer = createMockWriter({ 'storyflow.json': JSON.stringify(storyflow) })

      const result = await loadProjectFromFolder(writer)

      expect(result.success).toBe(true)
      expect(result.data?.project.title).toBe('My Novel')
      expect(result.data?.canvas.nodes).toHaveLength(1)
      expect(result.data?.chapters).toHaveLength(1)
    })

    it('should fall back to legacy project.json + canvas.json', async () => {
      const writer = createMockWriter({
        'project.json': JSON.stringify({ id: 'proj-1', title: 'Legacy Project' }),
        'canvas.json': JSON.stringify({ nodes: [{ id: 'n1' }], wires: [{ id: 'w1' }] }),
      })

      const result = await loadProjectFromFolder(writer)

      expect(result.success).toBe(true)
      expect(result.data?.project.title).toBe('Legacy Project')
      expect(result.data?.canvas.nodes).toHaveLength(1)
      expect(result.data?.canvas.wires).toHaveLength(1)
      // Legacy: no world data
      expect(result.data?.world.characters).toEqual([])
    })

    it('should return error when no storyflow.json or project.json found', async () => {
      const writer = createMockWriter()

      const result = await loadProjectFromFolder(writer)

      expect(result.success).toBe(false)
      expect(result.error).toContain('storyflow.json not found')
    })
  })

  // ── Indirect jsonContentToMarkdown tests (via manuscript.md output) ──

  describe('jsonContentToMarkdown (via manuscript.md)', () => {
    async function getManuscriptMd(content: any, chapterOverrides: Partial<Chapter> = {}): Promise<string> {
      const writer = createMockWriter()
      const chapter = makeChapter({ content, ...chapterOverrides })
      await saveProjectToFolder(writer, makeSaveParams({ chapters: [chapter] }))
      return writer.written['manuscript.md']
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

    it('should convert bold text to **text**', async () => {
      const content = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'important', marks: [{ type: 'bold' }] }],
        }],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('**important**')
    })

    it('should convert italic text to *text*', async () => {
      const content = {
        type: 'doc',
        content: [{
          type: 'paragraph',
          content: [{ type: 'text', text: 'emphasis', marks: [{ type: 'italic' }] }],
        }],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('*emphasis*')
    })

    it('should convert bullet lists to - item', async () => {
      const content = {
        type: 'doc',
        content: [{
          type: 'bulletList',
          content: [
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Apple' }] }] },
            { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Banana' }] }] },
          ],
        }],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('- Apple')
      expect(md).toContain('- Banana')
    })

    it('should convert blockquotes to > text', async () => {
      const content = {
        type: 'doc',
        content: [{
          type: 'blockquote',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A wise saying.' }] }],
        }],
      }
      const md = await getManuscriptMd(content)
      expect(md).toContain('> A wise saying.')
    })

    it('should handle null content as empty string', async () => {
      const md = await getManuscriptMd(null)
      expect(md).toContain('## Chapter One')
    })

    it('should render chapter synopsis as > synopsis', async () => {
      const md = await getManuscriptMd(null, { synopsis: 'A brief summary.' })
      expect(md).toContain('> A brief summary.')
    })

    it('should render volume as # heading and chapter as ## heading', async () => {
      const writer = createMockWriter()
      const volume = makeChapter({ id: 'vol-1', title: 'Volume 1', type: 'volume', order: 0, parentId: null })
      const chapter = makeChapter({ id: 'ch-1', title: 'Chapter 1', type: 'chapter', order: 1, parentId: 'vol-1' })

      await saveProjectToFolder(writer, makeSaveParams({ chapters: [volume, chapter] }))

      const md = writer.written['manuscript.md']
      expect(md).toMatch(/^# Volume 1$/m)
      expect(md).toMatch(/^## Chapter 1$/m)
    })
  })
})
