/**
 * Unit tests for wikiStore.
 * Tests: entry CRUD, linked entries, search/filter, selection.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWikiStore } from './wikiStore'

// ── Mock the storage adapter ──
const mockAdapter = {
  fetchWikiEntries: vi.fn().mockResolvedValue([]),
  insertWikiEntry: vi.fn().mockResolvedValue(undefined),
  updateWikiEntry: vi.fn().mockResolvedValue(undefined),
  deleteWikiEntry: vi.fn().mockResolvedValue(undefined),
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

function resetStore() {
  useWikiStore.setState({
    entries: [],
    selectedEntryId: null,
    searchQuery: '',
    filterCategory: 'all',
    loading: false,
  })
}

describe('wikiStore', () => {
  beforeEach(() => {
    idCounter = 0
    resetStore()
    vi.clearAllMocks()
  })

  // ── Load Entries ──

  describe('loadEntries', () => {
    it('should load entries from the adapter', async () => {
      const entries = [
        { id: 'w1', projectId: 'p1', category: 'character', title: 'Hero', content: '', tags: [], order: 0, createdAt: 1, updatedAt: 1 },
      ]
      mockAdapter.fetchWikiEntries.mockResolvedValueOnce(entries)

      await useWikiStore.getState().loadEntries('p1')

      expect(mockAdapter.fetchWikiEntries).toHaveBeenCalledWith('p1')
      expect(useWikiStore.getState().entries).toEqual(entries)
      expect(useWikiStore.getState().loading).toBe(false)
    })

    it('should set loading to true while fetching', async () => {
      let capturedLoading = false
      mockAdapter.fetchWikiEntries.mockImplementationOnce(async () => {
        capturedLoading = useWikiStore.getState().loading
        return []
      })

      await useWikiStore.getState().loadEntries('p1')
      expect(capturedLoading).toBe(true)
      expect(useWikiStore.getState().loading).toBe(false)
    })

    it('should set entries to empty array on error', async () => {
      mockAdapter.fetchWikiEntries.mockRejectedValueOnce(new Error('fail'))

      await useWikiStore.getState().loadEntries('p1')
      expect(useWikiStore.getState().entries).toEqual([])
      expect(useWikiStore.getState().loading).toBe(false)
    })
  })

  // ── Create Entry ──

  describe('createEntry', () => {
    it('should create an entry with correct properties', async () => {
      const entry = await useWikiStore.getState().createEntry('p1', 'magic', 'Magic System')

      expect(entry.id).toBe('test-id-1')
      expect(entry.projectId).toBe('p1')
      expect(entry.category).toBe('magic')
      expect(entry.title).toBe('Magic System')
      expect(entry.content).toBe('')
      expect(entry.tags).toEqual([])
      expect(entry.order).toBe(0)
      expect(entry.createdAt).toBe(1700000000000)
      expect(mockAdapter.insertWikiEntry).toHaveBeenCalledTimes(1)
      expect(useWikiStore.getState().entries).toHaveLength(1)
    })

    it('should auto-increment order', async () => {
      await useWikiStore.getState().createEntry('p1', 'magic', 'Entry 1')
      const entry2 = await useWikiStore.getState().createEntry('p1', 'character', 'Entry 2')

      expect(entry2.order).toBe(1)
    })
  })

  // ── Update Entry ──

  describe('updateEntry', () => {
    it('should update an entry and add updatedAt timestamp', async () => {
      await useWikiStore.getState().createEntry('p1', 'magic', 'Magic')

      await useWikiStore.getState().updateEntry('test-id-1', { title: 'Updated Magic' })

      expect(mockAdapter.updateWikiEntry).toHaveBeenCalledWith('test-id-1', { title: 'Updated Magic', updatedAt: 1700000000000 })
      const entry = useWikiStore.getState().entries[0]
      expect(entry.title).toBe('Updated Magic')
      expect(entry.updatedAt).toBe(1700000000000)
    })

    it('should not affect other entries', async () => {
      await useWikiStore.getState().createEntry('p1', 'magic', 'Magic')
      await useWikiStore.getState().createEntry('p1', 'character', 'Hero')

      await useWikiStore.getState().updateEntry('test-id-1', { title: 'Updated' })

      expect(useWikiStore.getState().entries[1].title).toBe('Hero')
    })
  })

  // ── Delete Entry ──

  describe('deleteEntry', () => {
    it('should remove an entry', async () => {
      await useWikiStore.getState().createEntry('p1', 'magic', 'Magic')

      await useWikiStore.getState().deleteEntry('test-id-1')

      expect(mockAdapter.deleteWikiEntry).toHaveBeenCalledWith('test-id-1')
      expect(useWikiStore.getState().entries).toHaveLength(0)
    })

    it('should clear selectedEntryId if deleted entry was selected', async () => {
      await useWikiStore.getState().createEntry('p1', 'magic', 'Magic')
      useWikiStore.getState().selectEntry('test-id-1')
      expect(useWikiStore.getState().selectedEntryId).toBe('test-id-1')

      await useWikiStore.getState().deleteEntry('test-id-1')
      expect(useWikiStore.getState().selectedEntryId).toBeNull()
    })

    it('should not clear selectedEntryId if a different entry was deleted', async () => {
      await useWikiStore.getState().createEntry('p1', 'magic', 'Magic')
      await useWikiStore.getState().createEntry('p1', 'character', 'Hero')
      useWikiStore.getState().selectEntry('test-id-1')

      await useWikiStore.getState().deleteEntry('test-id-2')

      expect(useWikiStore.getState().selectedEntryId).toBe('test-id-1')
    })
  })

  // ── Select Entry ──

  describe('selectEntry', () => {
    it('should set selectedEntryId', () => {
      useWikiStore.getState().selectEntry('w1')
      expect(useWikiStore.getState().selectedEntryId).toBe('w1')
    })

    it('should clear selection with null', () => {
      useWikiStore.getState().selectEntry('w1')
      useWikiStore.getState().selectEntry(null)
      expect(useWikiStore.getState().selectedEntryId).toBeNull()
    })
  })

  // ── Linked Entries ──

  describe('createLinkedEntry', () => {
    it('should create an entry linked to an entity', async () => {
      const entry = await useWikiStore.getState().createLinkedEntry(
        'p1', 'char-1', 'character', 'character', 'Hero Wiki', 'Hero description'
      )

      expect(entry.linkedEntityId).toBe('char-1')
      expect(entry.linkedEntityType).toBe('character')
      expect(entry.category).toBe('character')
      expect(entry.title).toBe('Hero Wiki')
      expect(entry.content).toBe('Hero description')
      expect(mockAdapter.insertWikiEntry).toHaveBeenCalledTimes(1)
    })
  })

  describe('findLinkedEntry', () => {
    it('should find an entry linked to a specific entity', async () => {
      await useWikiStore.getState().createLinkedEntry(
        'p1', 'char-1', 'character', 'character', 'Hero Wiki', 'desc'
      )

      const found = useWikiStore.getState().findLinkedEntry('char-1', 'character')
      expect(found).toBeDefined()
      expect(found!.linkedEntityId).toBe('char-1')
    })

    it('should return undefined when no linked entry exists', () => {
      const found = useWikiStore.getState().findLinkedEntry('nonexistent', 'character')
      expect(found).toBeUndefined()
    })
  })

  // ── Search & Filter ──

  describe('setSearchQuery', () => {
    it('should set the search query', () => {
      useWikiStore.getState().setSearchQuery('magic')
      expect(useWikiStore.getState().searchQuery).toBe('magic')
    })
  })

  describe('setFilterCategory', () => {
    it('should set the filter category', () => {
      useWikiStore.getState().setFilterCategory('magic')
      expect(useWikiStore.getState().filterCategory).toBe('magic')
    })

    it('should accept "all" as filter', () => {
      useWikiStore.getState().setFilterCategory('magic')
      useWikiStore.getState().setFilterCategory('all')
      expect(useWikiStore.getState().filterCategory).toBe('all')
    })
  })

  describe('getFilteredEntries', () => {
    beforeEach(async () => {
      // Seed entries manually for filtering tests
      useWikiStore.setState({
        entries: [
          { id: 'w1', projectId: 'p1', category: 'magic' as const, title: 'Fire Magic', content: 'Flames and sparks', tags: ['elemental'], order: 2, createdAt: 1, updatedAt: 1 },
          { id: 'w2', projectId: 'p1', category: 'character' as const, title: 'Hero', content: 'Brave warrior', tags: ['protagonist'], order: 0, createdAt: 1, updatedAt: 1 },
          { id: 'w3', projectId: 'p1', category: 'magic' as const, title: 'Ice Magic', content: 'Frozen power', tags: ['elemental', 'ice'], order: 1, createdAt: 1, updatedAt: 1 },
        ],
      })
    })

    it('should return all entries sorted by order when no filters', () => {
      const filtered = useWikiStore.getState().getFilteredEntries()
      expect(filtered).toHaveLength(3)
      expect(filtered[0].id).toBe('w2') // order 0
      expect(filtered[1].id).toBe('w3') // order 1
      expect(filtered[2].id).toBe('w1') // order 2
    })

    it('should filter by category', () => {
      useWikiStore.getState().setFilterCategory('magic')
      const filtered = useWikiStore.getState().getFilteredEntries()
      expect(filtered).toHaveLength(2)
      expect(filtered.every(e => e.category === 'magic')).toBe(true)
    })

    it('should filter by search query in title', () => {
      useWikiStore.getState().setSearchQuery('fire')
      const filtered = useWikiStore.getState().getFilteredEntries()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Fire Magic')
    })

    it('should filter by search query in content', () => {
      useWikiStore.getState().setSearchQuery('warrior')
      const filtered = useWikiStore.getState().getFilteredEntries()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('w2')
    })

    it('should filter by search query in tags', () => {
      useWikiStore.getState().setSearchQuery('elemental')
      const filtered = useWikiStore.getState().getFilteredEntries()
      expect(filtered).toHaveLength(2) // w1 and w3 both have 'elemental' tag
      expect(filtered.some(e => e.id === 'w1')).toBe(true)
      expect(filtered.some(e => e.id === 'w3')).toBe(true)
    })

    it('should combine category and search filters', () => {
      useWikiStore.getState().setFilterCategory('magic')
      useWikiStore.getState().setSearchQuery('fire')
      const filtered = useWikiStore.getState().getFilteredEntries()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].title).toBe('Fire Magic')
    })

    it('should be case-insensitive', () => {
      useWikiStore.getState().setSearchQuery('HERO')
      const filtered = useWikiStore.getState().getFilteredEntries()
      expect(filtered).toHaveLength(1)
      expect(filtered[0].id).toBe('w2')
    })

    it('should return empty array when no matches', () => {
      useWikiStore.getState().setSearchQuery('nonexistent')
      const filtered = useWikiStore.getState().getFilteredEntries()
      expect(filtered).toHaveLength(0)
    })

    it('should ignore whitespace-only search queries', () => {
      useWikiStore.getState().setSearchQuery('   ')
      const filtered = useWikiStore.getState().getFilteredEntries()
      expect(filtered).toHaveLength(3)
    })
  })
})
