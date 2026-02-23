/**
 * Unit tests for versionStore.
 * Tests: version CRUD, timeline snapshot CRUD, loading state.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useVersionStore } from './versionStore'

// ── Mock the storage adapter ──
const mockAdapter = {
  fetchVersions: vi.fn().mockResolvedValue([]),
  getMaxVersionNumber: vi.fn().mockResolvedValue(0),
  insertVersion: vi.fn().mockResolvedValue(undefined),
  deleteVersion: vi.fn().mockResolvedValue(undefined),
  fetchTimelineSnapshots: vi.fn().mockResolvedValue([]),
  insertTimelineSnapshot: vi.fn().mockResolvedValue(undefined),
  deleteTimelineSnapshot: vi.fn().mockResolvedValue(undefined),
  deleteChaptersByProject: vi.fn().mockResolvedValue(undefined),
  deleteCanvasNodesByProject: vi.fn().mockResolvedValue(undefined),
  deleteCanvasWiresByProject: vi.fn().mockResolvedValue(undefined),
  deleteWikiEntriesByProject: vi.fn().mockResolvedValue(undefined),
  insertChapter: vi.fn().mockResolvedValue(undefined),
  insertCanvasNode: vi.fn().mockResolvedValue(undefined),
  insertCanvasWire: vi.fn().mockResolvedValue(undefined),
  insertWikiEntry: vi.fn().mockResolvedValue(undefined),
  insertCharacter: vi.fn().mockResolvedValue(undefined),
  insertRelation: vi.fn().mockResolvedValue(undefined),
  insertWorldSetting: vi.fn().mockResolvedValue(undefined),
  insertForeshadow: vi.fn().mockResolvedValue(undefined),
  insertItem: vi.fn().mockResolvedValue(undefined),
  transaction: vi.fn().mockImplementation(async (fn: () => Promise<void>) => fn()),
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

// Mock dependent stores for timeline snapshot creation
vi.mock('./projectStore', () => ({
  useProjectStore: {
    getState: () => ({
      chapters: [{ id: 'ch1', title: 'Chapter 1', content: null, wordCount: 0 }],
      loadChapters: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('./canvasStore', () => ({
  useCanvasStore: {
    getState: () => ({
      exportCanvas: () => ({
        nodes: [{ id: 'n1', type: 'character' }],
        wires: [{ id: 'w1', sourceNodeId: 'n1', targetNodeId: 'n2' }],
      }),
      loadCanvas: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('./wikiStore', () => ({
  useWikiStore: {
    getState: () => ({
      entries: [{ id: 'wiki1', title: 'Entry 1' }],
      loadEntries: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

vi.mock('./worldStore', () => ({
  useWorldStore: {
    getState: () => ({
      characters: [{ id: 'c1', name: 'Hero' }],
      relations: [{ id: 'r1' }],
      worldSettings: [{ id: 'ws1' }],
      foreshadows: [{ id: 'f1' }],
      items: [{ id: 'i1' }],
      loadAll: vi.fn().mockResolvedValue(undefined),
    }),
  },
}))

function resetStore() {
  useVersionStore.setState({
    versions: [],
    timelineSnapshots: [],
    loading: false,
  })
}

describe('versionStore', () => {
  beforeEach(() => {
    idCounter = 0
    resetStore()
    vi.clearAllMocks()
  })

  // ── Entity Versions ──

  describe('loadVersions', () => {
    it('should load versions from the adapter', async () => {
      const versions = [
        { id: 'v1', projectId: 'p1', entityType: 'chapter', entityId: 'ch1', versionNumber: 1, data: {}, label: 'v1', createdBy: 'user', createdAt: 1 },
      ]
      mockAdapter.fetchVersions.mockResolvedValueOnce(versions)

      await useVersionStore.getState().loadVersions('p1')

      expect(mockAdapter.fetchVersions).toHaveBeenCalledWith('p1', undefined, undefined)
      expect(useVersionStore.getState().versions).toEqual(versions)
      expect(useVersionStore.getState().loading).toBe(false)
    })

    it('should pass entityType and entityId when provided', async () => {
      mockAdapter.fetchVersions.mockResolvedValueOnce([])

      await useVersionStore.getState().loadVersions('p1', 'chapter', 'ch1')

      expect(mockAdapter.fetchVersions).toHaveBeenCalledWith('p1', 'chapter', 'ch1')
    })

    it('should set loading to true while fetching', async () => {
      let capturedLoading = false
      mockAdapter.fetchVersions.mockImplementationOnce(async () => {
        capturedLoading = useVersionStore.getState().loading
        return []
      })

      await useVersionStore.getState().loadVersions('p1')
      expect(capturedLoading).toBe(true)
      expect(useVersionStore.getState().loading).toBe(false)
    })
  })

  describe('createVersion', () => {
    it('should create a version with auto-incremented version number', async () => {
      mockAdapter.getMaxVersionNumber.mockResolvedValueOnce(3)

      const version = await useVersionStore.getState().createVersion({
        projectId: 'p1',
        entityType: 'chapter',
        entityId: 'ch1',
        data: { title: 'Test' },
        label: 'Draft 4',
        createdBy: 'user',
      })

      expect(version.id).toBe('test-id-1')
      expect(version.versionNumber).toBe(4) // 3 + 1
      expect(version.projectId).toBe('p1')
      expect(version.entityType).toBe('chapter')
      expect(version.entityId).toBe('ch1')
      expect(version.label).toBe('Draft 4')
      expect(version.createdBy).toBe('user')
      expect(version.createdAt).toBe(1700000000000)
      expect(mockAdapter.insertVersion).toHaveBeenCalledTimes(1)
    })

    it('should prepend the new version to the state', async () => {
      mockAdapter.getMaxVersionNumber.mockResolvedValue(0)

      await useVersionStore.getState().createVersion({
        projectId: 'p1', entityType: 'chapter', entityId: 'ch1',
        data: {}, label: 'v1', createdBy: 'user',
      })
      await useVersionStore.getState().createVersion({
        projectId: 'p1', entityType: 'chapter', entityId: 'ch1',
        data: {}, label: 'v2', createdBy: 'ai',
      })

      const versions = useVersionStore.getState().versions
      expect(versions).toHaveLength(2)
      // Newest first
      expect(versions[0].label).toBe('v2')
      expect(versions[1].label).toBe('v1')
    })

    it('should support ai createdBy', async () => {
      mockAdapter.getMaxVersionNumber.mockResolvedValueOnce(0)

      const version = await useVersionStore.getState().createVersion({
        projectId: 'p1', entityType: 'character', entityId: 'c1',
        data: { name: 'Hero' }, label: 'AI edit', createdBy: 'ai',
      })

      expect(version.createdBy).toBe('ai')
    })
  })

  describe('deleteVersion', () => {
    it('should remove a version from state and adapter', async () => {
      mockAdapter.getMaxVersionNumber.mockResolvedValueOnce(0)
      await useVersionStore.getState().createVersion({
        projectId: 'p1', entityType: 'chapter', entityId: 'ch1',
        data: {}, label: 'v1', createdBy: 'user',
      })

      await useVersionStore.getState().deleteVersion('test-id-1')

      expect(mockAdapter.deleteVersion).toHaveBeenCalledWith('test-id-1')
      expect(useVersionStore.getState().versions).toHaveLength(0)
    })
  })

  // ── Timeline Snapshots ──

  describe('loadTimelineSnapshots', () => {
    it('should load timeline snapshots from the adapter', async () => {
      const snapshots = [
        { id: 's1', projectId: 'p1', label: 'Snapshot 1', canvasData: '{}', manuscriptData: '[]', wikiData: '[]', worldData: '{}', createdAt: 1 },
      ]
      mockAdapter.fetchTimelineSnapshots.mockResolvedValueOnce(snapshots)

      await useVersionStore.getState().loadTimelineSnapshots('p1')

      expect(mockAdapter.fetchTimelineSnapshots).toHaveBeenCalledWith('p1')
      expect(useVersionStore.getState().timelineSnapshots).toEqual(snapshots)
      expect(useVersionStore.getState().loading).toBe(false)
    })
  })

  describe('createTimelineSnapshot', () => {
    it('should create a snapshot with data from all stores', async () => {
      const snapshot = await useVersionStore.getState().createTimelineSnapshot('p1', 'Before refactor')

      expect(snapshot.id).toBe('test-id-1')
      expect(snapshot.projectId).toBe('p1')
      expect(snapshot.label).toBe('Before refactor')
      expect(snapshot.createdAt).toBe(1700000000000)

      // Verify canvas data was serialized
      const canvasData = JSON.parse(snapshot.canvasData)
      expect(canvasData.nodes).toHaveLength(1)
      expect(canvasData.wires).toHaveLength(1)

      // Verify manuscript data
      const manuscriptData = JSON.parse(snapshot.manuscriptData)
      expect(manuscriptData).toHaveLength(1)

      // Verify wiki data
      const wikiData = JSON.parse(snapshot.wikiData)
      expect(wikiData).toHaveLength(1)

      // Verify world data
      const worldData = JSON.parse(snapshot.worldData)
      expect(worldData.characters).toHaveLength(1)
      expect(worldData.relations).toHaveLength(1)

      expect(mockAdapter.insertTimelineSnapshot).toHaveBeenCalledTimes(1)
      expect(useVersionStore.getState().timelineSnapshots).toHaveLength(1)
    })

    it('should prepend new snapshot to state', async () => {
      await useVersionStore.getState().createTimelineSnapshot('p1', 'Snap 1')
      await useVersionStore.getState().createTimelineSnapshot('p1', 'Snap 2')

      const snapshots = useVersionStore.getState().timelineSnapshots
      expect(snapshots).toHaveLength(2)
      expect(snapshots[0].label).toBe('Snap 2')
    })
  })

  describe('deleteTimelineSnapshot', () => {
    it('should remove a timeline snapshot', async () => {
      await useVersionStore.getState().createTimelineSnapshot('p1', 'Snap 1')

      await useVersionStore.getState().deleteTimelineSnapshot('test-id-1')

      expect(mockAdapter.deleteTimelineSnapshot).toHaveBeenCalledWith('test-id-1')
      expect(useVersionStore.getState().timelineSnapshots).toHaveLength(0)
    })
  })

  describe('restoreTimelineSnapshot', () => {
    it('should restore a snapshot using transaction', async () => {
      // Create a snapshot first
      await useVersionStore.getState().createTimelineSnapshot('p1', 'Snap 1')
      const snapshotId = useVersionStore.getState().timelineSnapshots[0].id

      await useVersionStore.getState().restoreTimelineSnapshot(snapshotId)

      // Should have used transaction
      expect(mockAdapter.transaction).toHaveBeenCalledTimes(1)
      // Should have cleared existing data
      expect(mockAdapter.deleteChaptersByProject).toHaveBeenCalledWith('p1')
      expect(mockAdapter.deleteCanvasNodesByProject).toHaveBeenCalledWith('p1')
      expect(mockAdapter.deleteCanvasWiresByProject).toHaveBeenCalledWith('p1')
      expect(mockAdapter.deleteWikiEntriesByProject).toHaveBeenCalledWith('p1')
      // Should have restored data
      expect(mockAdapter.insertChapter).toHaveBeenCalled()
      expect(mockAdapter.insertCanvasNode).toHaveBeenCalled()
      expect(mockAdapter.insertCanvasWire).toHaveBeenCalled()
      expect(mockAdapter.insertWikiEntry).toHaveBeenCalled()
      expect(mockAdapter.insertCharacter).toHaveBeenCalled()
    })

    it('should do nothing if snapshot not found', async () => {
      await useVersionStore.getState().restoreTimelineSnapshot('nonexistent')
      expect(mockAdapter.transaction).not.toHaveBeenCalled()
    })
  })
})
