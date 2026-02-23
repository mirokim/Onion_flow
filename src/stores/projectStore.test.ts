/**
 * Unit tests for projectStore.
 * Tests: project CRUD, chapter CRUD, chapter tree, chapter reorder/move,
 *        undo delete, word count, toggleExpanded.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useProjectStore } from './projectStore'
import type { Project, Chapter } from '@/types'

// ── Mock the storage adapter ──
const mockAdapter = {
  fetchProjects: vi.fn().mockResolvedValue([]),
  fetchProject: vi.fn().mockResolvedValue(null),
  insertProject: vi.fn().mockResolvedValue(undefined),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  fetchChapters: vi.fn().mockResolvedValue([]),
  insertChapter: vi.fn().mockResolvedValue(undefined),
  updateChapter: vi.fn().mockResolvedValue(undefined),
  deleteChapter: vi.fn().mockResolvedValue(undefined),
  deleteChaptersByProject: vi.fn().mockResolvedValue(undefined),
  deleteCanvasNodesByProject: vi.fn().mockResolvedValue(undefined),
  deleteCanvasWiresByProject: vi.fn().mockResolvedValue(undefined),
  deleteWikiEntriesByProject: vi.fn().mockResolvedValue(undefined),
  deleteEmotionLogsByProject: vi.fn().mockResolvedValue(undefined),
  deleteStorySummariesByProject: vi.fn().mockResolvedValue(undefined),
  clearForeshadowChapterRefs: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/db/storageAdapter', () => ({
  getAdapter: () => mockAdapter,
}))

let idCounter = 0
vi.mock('@/lib/utils', () => ({
  generateId: () => `test-id-${++idCounter}`,
}))

vi.mock('@/lib/dateUtils', () => ({
  nowUTC: () => 1700000000000,
}))

vi.mock('@/lib/storeHelpers', async () => {
  const actual = await vi.importActual('@/lib/storeHelpers')
  return actual
})

// Mock editorStore
vi.mock('./editorStore', () => ({
  useEditorStore: {
    getState: () => ({
      removeFoldedNodesByChapter: vi.fn(),
    }),
  },
}))

// Mock worldStore, canvasStore, wikiStore (used by createProject/selectProject)
vi.mock('./worldStore', () => ({
  useWorldStore: {
    getState: () => ({
      loadAll: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('./canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      loadCanvas: vi.fn().mockResolvedValue(undefined),
      createDefaultTemplate: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('./wikiStore', () => ({
  useWikiStore: {
    getState: () => ({
      loadEntries: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

function makeChapter(overrides: Partial<Chapter> = {}): Chapter {
  return {
    id: `ch-${++idCounter}`,
    projectId: 'p1',
    title: 'Chapter',
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

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: `proj-${++idCounter}`,
    title: 'Test Project',
    description: '',
    genre: '',
    synopsis: '',
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    settings: { language: 'ko', targetDailyWords: 3000, readingSpeedCPM: 500 },
    ...overrides,
  }
}

function resetStore() {
  useProjectStore.setState({
    projects: [],
    currentProject: null,
    chapters: [],
    currentChapter: null,
    deletedChapterStack: [],
    undoToastVisible: false,
  })
}

describe('projectStore', () => {
  beforeEach(() => {
    idCounter = 0
    resetStore()
    vi.clearAllMocks()
  })

  // ── Project CRUD ──

  describe('loadProjects', () => {
    it('should load projects from the adapter', async () => {
      const projects = [makeProject({ id: 'p1', title: 'Project 1' })]
      mockAdapter.fetchProjects.mockResolvedValueOnce(projects)

      await useProjectStore.getState().loadProjects()

      expect(mockAdapter.fetchProjects).toHaveBeenCalledTimes(1)
      expect(useProjectStore.getState().projects).toEqual(projects)
    })
  })

  describe('updateProject', () => {
    it('should update a project and persist', async () => {
      const project = makeProject({ id: 'p1' })
      useProjectStore.setState({ projects: [project], currentProject: project })

      await useProjectStore.getState().updateProject('p1', { title: 'New Title' })

      expect(mockAdapter.updateProject).toHaveBeenCalledWith('p1', expect.objectContaining({
        title: 'New Title',
        updatedAt: 1700000000000,
      }))
      expect(useProjectStore.getState().projects[0].title).toBe('New Title')
      expect(useProjectStore.getState().currentProject!.title).toBe('New Title')
    })

    it('should not update currentProject if a different project is updated', async () => {
      const p1 = makeProject({ id: 'p1', title: 'P1' })
      const p2 = makeProject({ id: 'p2', title: 'P2' })
      useProjectStore.setState({ projects: [p1, p2], currentProject: p1 })

      await useProjectStore.getState().updateProject('p2', { title: 'Updated P2' })

      expect(useProjectStore.getState().currentProject!.title).toBe('P1')
    })
  })

  describe('deleteProject', () => {
    it('should delete a project and all associated data', async () => {
      const project = makeProject({ id: 'p1' })
      useProjectStore.setState({ projects: [project], currentProject: project, chapters: [makeChapter()], currentChapter: makeChapter() })

      await useProjectStore.getState().deleteProject('p1')

      expect(mockAdapter.deleteProject).toHaveBeenCalledWith('p1')
      expect(mockAdapter.deleteChaptersByProject).toHaveBeenCalledWith('p1')
      expect(mockAdapter.deleteCanvasNodesByProject).toHaveBeenCalledWith('p1')
      expect(mockAdapter.deleteCanvasWiresByProject).toHaveBeenCalledWith('p1')
      expect(mockAdapter.deleteWikiEntriesByProject).toHaveBeenCalledWith('p1')
      expect(mockAdapter.deleteEmotionLogsByProject).toHaveBeenCalledWith('p1')
      expect(mockAdapter.deleteStorySummariesByProject).toHaveBeenCalledWith('p1')
      expect(useProjectStore.getState().projects).toHaveLength(0)
      expect(useProjectStore.getState().currentProject).toBeNull()
    })

    it('should not clear currentProject if a different project is deleted', async () => {
      const p1 = makeProject({ id: 'p1' })
      const p2 = makeProject({ id: 'p2' })
      useProjectStore.setState({ projects: [p1, p2], currentProject: p1 })

      await useProjectStore.getState().deleteProject('p2')

      expect(useProjectStore.getState().currentProject!.id).toBe('p1')
      expect(useProjectStore.getState().projects).toHaveLength(1)
    })
  })

  // ── Chapter CRUD ──

  describe('loadChapters', () => {
    it('should load chapters and set first as current if none selected', async () => {
      const chapters = [
        makeChapter({ id: 'ch-a', order: 0 }),
        makeChapter({ id: 'ch-b', order: 1 }),
      ]
      mockAdapter.fetchChapters.mockResolvedValueOnce(chapters)

      await useProjectStore.getState().loadChapters('p1')

      expect(useProjectStore.getState().chapters).toHaveLength(2)
      expect(useProjectStore.getState().currentChapter!.id).toBe('ch-a')
    })

    it('should expand volume chapters that are not expanded', async () => {
      const chapters = [
        makeChapter({ id: 'ch-v', type: 'volume', isExpanded: false }),
      ]
      mockAdapter.fetchChapters.mockResolvedValueOnce(chapters)

      await useProjectStore.getState().loadChapters('p1')

      expect(useProjectStore.getState().chapters[0].isExpanded).toBe(true)
    })
  })

  describe('createChapter', () => {
    it('should create a chapter under the current project', async () => {
      useProjectStore.setState({ currentProject: makeProject({ id: 'p1' }) })

      const chapter = await useProjectStore.getState().createChapter('Chapter 1')

      expect(chapter.projectId).toBe('p1')
      expect(chapter.title).toBe('Chapter 1')
      expect(chapter.type).toBe('chapter')
      expect(chapter.parentId).toBeNull()
      expect(chapter.order).toBe(0)
      expect(mockAdapter.insertChapter).toHaveBeenCalledTimes(1)
    })

    it('should throw if no project is selected', async () => {
      await expect(
        useProjectStore.getState().createChapter('Chapter 1')
      ).rejects.toThrow('No project selected')
    })

    it('should auto-increment order among siblings', async () => {
      useProjectStore.setState({
        currentProject: makeProject({ id: 'p1' }),
        chapters: [makeChapter({ id: 'ch1', order: 0, parentId: null })],
      })

      const ch = await useProjectStore.getState().createChapter('Chapter 2')
      expect(ch.order).toBe(1)
    })

    it('should create a volume with parentId null', async () => {
      useProjectStore.setState({ currentProject: makeProject({ id: 'p1' }) })

      const vol = await useProjectStore.getState().createChapter('Volume 1', null, 'volume')
      expect(vol.type).toBe('volume')
      expect(vol.parentId).toBeNull()
    })

    it('should create a chapter under a parent', async () => {
      useProjectStore.setState({
        currentProject: makeProject({ id: 'p1' }),
        chapters: [makeChapter({ id: 'vol-1', type: 'volume', parentId: null })],
      })

      const ch = await useProjectStore.getState().createChapter('Chapter 1', 'vol-1')
      expect(ch.parentId).toBe('vol-1')
    })
  })

  describe('selectChapter', () => {
    it('should set the current chapter', () => {
      const ch = makeChapter({ id: 'ch1' })
      useProjectStore.setState({ chapters: [ch] })

      useProjectStore.getState().selectChapter('ch1')

      expect(useProjectStore.getState().currentChapter).toEqual(ch)
    })

    it('should not change currentChapter if chapter not found', () => {
      useProjectStore.setState({ currentChapter: null, chapters: [] })

      useProjectStore.getState().selectChapter('nonexistent')
      expect(useProjectStore.getState().currentChapter).toBeNull()
    })
  })

  describe('updateChapter', () => {
    it('should update a chapter and persist', async () => {
      const ch = makeChapter({ id: 'ch1' })
      useProjectStore.setState({ chapters: [ch], currentChapter: ch })

      await useProjectStore.getState().updateChapter('ch1', { title: 'Updated Title' })

      expect(mockAdapter.updateChapter).toHaveBeenCalledWith('ch1', expect.objectContaining({
        title: 'Updated Title',
        updatedAt: 1700000000000,
      }))
      expect(useProjectStore.getState().chapters[0].title).toBe('Updated Title')
      expect(useProjectStore.getState().currentChapter!.title).toBe('Updated Title')
    })
  })

  describe('updateChapterContent', () => {
    it('should update chapter content', async () => {
      const ch = makeChapter({ id: 'ch1' })
      useProjectStore.setState({ chapters: [ch], currentChapter: ch })
      const content = { type: 'doc', content: [{ type: 'paragraph' }] }

      await useProjectStore.getState().updateChapterContent('ch1', content as any)

      expect(mockAdapter.updateChapter).toHaveBeenCalledWith('ch1', expect.objectContaining({
        content,
        updatedAt: 1700000000000,
      }))
      expect(useProjectStore.getState().chapters[0].content).toEqual(content)
      expect(useProjectStore.getState().currentChapter!.content).toEqual(content)
    })
  })

  describe('deleteChapter', () => {
    it('should delete a chapter and its children', async () => {
      const parent = makeChapter({ id: 'vol1', type: 'volume' })
      const child1 = makeChapter({ id: 'ch1', parentId: 'vol1', order: 0 })
      const child2 = makeChapter({ id: 'ch2', parentId: 'vol1', order: 1 })
      const other = makeChapter({ id: 'ch3', parentId: null, order: 1 })
      useProjectStore.setState({ chapters: [parent, child1, child2, other], currentChapter: parent })

      await useProjectStore.getState().deleteChapter('vol1')

      expect(mockAdapter.deleteChapter).toHaveBeenCalledWith('vol1')
      expect(mockAdapter.deleteChapter).toHaveBeenCalledWith('ch1')
      expect(mockAdapter.deleteChapter).toHaveBeenCalledWith('ch2')
      expect(useProjectStore.getState().chapters).toHaveLength(1)
      expect(useProjectStore.getState().chapters[0].id).toBe('ch3')
    })

    it('should push deleted chapter to undo stack', async () => {
      const ch = makeChapter({ id: 'ch1' })
      useProjectStore.setState({ chapters: [ch], currentChapter: ch })

      await useProjectStore.getState().deleteChapter('ch1')

      const stack = useProjectStore.getState().deletedChapterStack
      expect(stack).toHaveLength(1)
      expect(stack[0].chapter.id).toBe('ch1')
    })

    it('should limit undo stack to 5 entries', async () => {
      const chapters = Array.from({ length: 7 }, (_, i) =>
        makeChapter({ id: `ch-${i}`, order: i })
      )
      useProjectStore.setState({ chapters, currentChapter: chapters[0] })

      for (let i = 0; i < 7; i++) {
        await useProjectStore.getState().deleteChapter(`ch-${i}`)
      }

      expect(useProjectStore.getState().deletedChapterStack.length).toBeLessThanOrEqual(5)
    })

    it('should select first remaining chapter if current was deleted', async () => {
      const ch1 = makeChapter({ id: 'ch1', order: 0 })
      const ch2 = makeChapter({ id: 'ch2', order: 1 })
      useProjectStore.setState({ chapters: [ch1, ch2], currentChapter: ch1 })

      await useProjectStore.getState().deleteChapter('ch1')

      expect(useProjectStore.getState().currentChapter!.id).toBe('ch2')
    })
  })

  describe('undoDeleteChapter', () => {
    it('should restore the last deleted chapter and its children', async () => {
      const ch = makeChapter({ id: 'ch1' })
      const child = makeChapter({ id: 'ch-child', parentId: 'ch1' })

      useProjectStore.setState({
        chapters: [],
        deletedChapterStack: [{ chapter: ch, children: [child], deletedAt: 1700000000000 }],
      })

      const result = await useProjectStore.getState().undoDeleteChapter()

      expect(result).toBe(true)
      expect(mockAdapter.insertChapter).toHaveBeenCalledWith(ch)
      expect(mockAdapter.insertChapter).toHaveBeenCalledWith(child)
      expect(useProjectStore.getState().chapters).toHaveLength(2)
      expect(useProjectStore.getState().deletedChapterStack).toHaveLength(0)
    })

    it('should return false when stack is empty', async () => {
      const result = await useProjectStore.getState().undoDeleteChapter()
      expect(result).toBe(false)
    })
  })

  // ── Reorder / Move ──

  describe('reorderChapter', () => {
    it('should update chapter order', async () => {
      const ch = makeChapter({ id: 'ch1', order: 0 })
      useProjectStore.setState({ chapters: [ch] })

      await useProjectStore.getState().reorderChapter('ch1', 5)

      expect(mockAdapter.updateChapter).toHaveBeenCalledWith('ch1', expect.objectContaining({ order: 5 }))
      expect(useProjectStore.getState().chapters[0].order).toBe(5)
    })
  })

  describe('moveChapter', () => {
    it('should move a chapter to a new parent', async () => {
      const vol = makeChapter({ id: 'vol1', type: 'volume', parentId: null, order: 0 })
      const ch = makeChapter({ id: 'ch1', parentId: null, order: 1 })
      useProjectStore.setState({ chapters: [vol, ch] })

      await useProjectStore.getState().moveChapter('ch1', 'vol1')

      expect(useProjectStore.getState().chapters.find(c => c.id === 'ch1')!.parentId).toBe('vol1')
    })

    it('should not move a volume to a non-null parent', async () => {
      const vol = makeChapter({ id: 'vol1', type: 'volume', parentId: null, order: 0 })
      useProjectStore.setState({ chapters: [vol] })

      await useProjectStore.getState().moveChapter('vol1', 'some-parent')

      expect(useProjectStore.getState().chapters[0].parentId).toBeNull()
    })

    it('should not move a chapter to itself', async () => {
      const ch = makeChapter({ id: 'ch1', parentId: null, order: 0 })
      useProjectStore.setState({ chapters: [ch] })

      await useProjectStore.getState().moveChapter('ch1', 'ch1')

      expect(mockAdapter.updateChapter).not.toHaveBeenCalled()
    })
  })

  describe('moveChapterToPosition', () => {
    it('should move a chapter to a specific position and shift siblings', async () => {
      const ch1 = makeChapter({ id: 'ch1', parentId: null, order: 0 })
      const ch2 = makeChapter({ id: 'ch2', parentId: null, order: 1 })
      const ch3 = makeChapter({ id: 'ch3', parentId: null, order: 2 })
      useProjectStore.setState({ chapters: [ch1, ch2, ch3] })

      await useProjectStore.getState().moveChapterToPosition('ch3', null, 0)

      const chapters = useProjectStore.getState().chapters
      expect(chapters.find(c => c.id === 'ch3')!.order).toBe(0)
      // ch1 and ch2 should have shifted
      expect(chapters.find(c => c.id === 'ch1')!.order).toBe(1)
      expect(chapters.find(c => c.id === 'ch2')!.order).toBe(2)
    })
  })

  describe('insertChapterAt', () => {
    it('should insert a chapter at a specific position', async () => {
      useProjectStore.setState({
        currentProject: makeProject({ id: 'p1' }),
        chapters: [
          makeChapter({ id: 'ch1', order: 0, parentId: null }),
          makeChapter({ id: 'ch2', order: 1, parentId: null }),
        ],
      })

      const ch = await useProjectStore.getState().insertChapterAt('Inserted', null, 1)

      expect(ch.order).toBe(1)
      // Existing siblings at order >= 1 should have shifted
      const chapters = useProjectStore.getState().chapters
      expect(chapters.find(c => c.id === 'ch2')!.order).toBe(2)
    })

    it('should throw if no project is selected', async () => {
      await expect(
        useProjectStore.getState().insertChapterAt('Test', null, 0)
      ).rejects.toThrow('No project selected')
    })
  })

  // ── Toggle Expanded ──

  describe('toggleExpanded', () => {
    it('should toggle isExpanded on a chapter', () => {
      const ch = makeChapter({ id: 'ch1', isExpanded: true })
      useProjectStore.setState({ chapters: [ch] })

      useProjectStore.getState().toggleExpanded('ch1')
      expect(useProjectStore.getState().chapters[0].isExpanded).toBe(false)

      useProjectStore.getState().toggleExpanded('ch1')
      expect(useProjectStore.getState().chapters[0].isExpanded).toBe(true)
    })
  })

  // ── Computed ──

  describe('getChapterTree', () => {
    it('should build a tree from flat chapters', () => {
      const vol = makeChapter({ id: 'vol1', type: 'volume', parentId: null, order: 0 })
      const ch1 = makeChapter({ id: 'ch1', parentId: 'vol1', order: 0 })
      const ch2 = makeChapter({ id: 'ch2', parentId: 'vol1', order: 1 })
      const ch3 = makeChapter({ id: 'ch3', parentId: null, order: 1 })
      useProjectStore.setState({ chapters: [vol, ch1, ch2, ch3] })

      const tree = useProjectStore.getState().getChapterTree()

      expect(tree).toHaveLength(2) // vol1 and ch3 at root
      expect(tree[0].id).toBe('vol1')
      expect(tree[0].children).toHaveLength(2)
      expect(tree[0].children[0].id).toBe('ch1')
      expect(tree[0].children[1].id).toBe('ch2')
      expect(tree[1].id).toBe('ch3')
    })

    it('should sort siblings by order', () => {
      const ch1 = makeChapter({ id: 'ch1', parentId: null, order: 2 })
      const ch2 = makeChapter({ id: 'ch2', parentId: null, order: 0 })
      const ch3 = makeChapter({ id: 'ch3', parentId: null, order: 1 })
      useProjectStore.setState({ chapters: [ch1, ch2, ch3] })

      const tree = useProjectStore.getState().getChapterTree()
      expect(tree[0].id).toBe('ch2')
      expect(tree[1].id).toBe('ch3')
      expect(tree[2].id).toBe('ch1')
    })
  })

  describe('getTotalWordCount', () => {
    it('should sum word counts of all chapters', () => {
      useProjectStore.setState({
        chapters: [
          makeChapter({ id: 'ch1', wordCount: 100 }),
          makeChapter({ id: 'ch2', wordCount: 250 }),
          makeChapter({ id: 'ch3', wordCount: 50 }),
        ],
      })

      expect(useProjectStore.getState().getTotalWordCount()).toBe(400)
    })

    it('should return 0 when there are no chapters', () => {
      expect(useProjectStore.getState().getTotalWordCount()).toBe(0)
    })
  })
})
