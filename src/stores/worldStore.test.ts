/**
 * Unit tests for worldStore.
 * Tests: character CRUD, relation CRUD (with duplicate handling),
 *        world setting CRUD, item CRUD, reference data CRUD,
 *        foreshadow CRUD, selection, loadAll.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useWorldStore } from './worldStore'

// ── Mock the storage adapter ──
const mockAdapter = {
  fetchCharacters: vi.fn().mockResolvedValue([]),
  insertCharacter: vi.fn().mockResolvedValue(undefined),
  updateCharacter: vi.fn().mockResolvedValue(undefined),
  deleteCharacter: vi.fn().mockResolvedValue(undefined),
  deleteRelationsByCharacter: vi.fn().mockResolvedValue(undefined),
  deleteVersionsByEntity: vi.fn().mockResolvedValue(undefined),
  fetchRelations: vi.fn().mockResolvedValue([]),
  insertRelation: vi.fn().mockResolvedValue(undefined),
  updateRelation: vi.fn().mockResolvedValue(undefined),
  deleteRelation: vi.fn().mockResolvedValue(undefined),
  cleanOrphanedRelations: vi.fn().mockResolvedValue(0),
  fetchWorldSettings: vi.fn().mockResolvedValue([]),
  insertWorldSetting: vi.fn().mockResolvedValue(undefined),
  updateWorldSetting: vi.fn().mockResolvedValue(undefined),
  deleteWorldSetting: vi.fn().mockResolvedValue(undefined),
  fetchItems: vi.fn().mockResolvedValue([]),
  insertItem: vi.fn().mockResolvedValue(undefined),
  updateItem: vi.fn().mockResolvedValue(undefined),
  deleteItem: vi.fn().mockResolvedValue(undefined),
  fetchReferenceData: vi.fn().mockResolvedValue([]),
  insertReferenceData: vi.fn().mockResolvedValue(undefined),
  updateReferenceData: vi.fn().mockResolvedValue(undefined),
  deleteReferenceData: vi.fn().mockResolvedValue(undefined),
  fetchForeshadows: vi.fn().mockResolvedValue([]),
  insertForeshadow: vi.fn().mockResolvedValue(undefined),
  updateForeshadow: vi.fn().mockResolvedValue(undefined),
  deleteForeshadow: vi.fn().mockResolvedValue(undefined),
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
  useWorldStore.setState({
    characters: [],
    relations: [],
    worldSettings: [],
    foreshadows: [],
    items: [],
    referenceData: [],
    selectedCharacterId: null,
    selectedItemId: null,
    selectedReferenceId: null,
  })
}

describe('worldStore', () => {
  beforeEach(() => {
    idCounter = 0
    resetStore()
    vi.clearAllMocks()
  })

  // ── Characters ──

  describe('loadCharacters', () => {
    it('should load characters from the adapter', async () => {
      const chars = [
        { id: 'c1', projectId: 'p1', name: 'Hero' },
        { id: 'c2', projectId: 'p1', name: 'Villain' },
      ]
      mockAdapter.fetchCharacters.mockResolvedValueOnce(chars)

      await useWorldStore.getState().loadCharacters('p1')

      expect(mockAdapter.fetchCharacters).toHaveBeenCalledWith('p1')
      expect(useWorldStore.getState().characters).toEqual(chars)
    })

    it('should set characters to empty array on error', async () => {
      mockAdapter.fetchCharacters.mockRejectedValueOnce(new Error('fail'))

      await useWorldStore.getState().loadCharacters('p1')
      expect(useWorldStore.getState().characters).toEqual([])
    })
  })

  describe('createCharacter', () => {
    it('should create a character with correct defaults', async () => {
      const char = await useWorldStore.getState().createCharacter('p1', 'Hero')

      expect(char.id).toBe('test-id-1')
      expect(char.projectId).toBe('p1')
      expect(char.name).toBe('Hero')
      expect(char.role).toBe('supporting')
      expect(char.aliases).toEqual([])
      expect(char.tags).toEqual([])
      expect(char.createdAt).toBe(1700000000000)
      expect(char.updatedAt).toBe(1700000000000)
      expect(mockAdapter.insertCharacter).toHaveBeenCalledTimes(1)
      expect(useWorldStore.getState().characters).toHaveLength(1)
    })
  })

  describe('updateCharacter', () => {
    it('should update a character and persist', async () => {
      await useWorldStore.getState().createCharacter('p1', 'Hero')

      await useWorldStore.getState().updateCharacter('test-id-1', { name: 'Super Hero' })

      expect(mockAdapter.updateCharacter).toHaveBeenCalledWith('test-id-1', expect.objectContaining({
        name: 'Super Hero',
        updatedAt: 1700000000000,
      }))
      expect(useWorldStore.getState().characters[0].name).toBe('Super Hero')
    })

    it('should not modify other characters', async () => {
      await useWorldStore.getState().createCharacter('p1', 'Hero')
      await useWorldStore.getState().createCharacter('p1', 'Sidekick')

      await useWorldStore.getState().updateCharacter('test-id-1', { name: 'Updated' })

      expect(useWorldStore.getState().characters[1].name).toBe('Sidekick')
    })
  })

  describe('deleteCharacter', () => {
    it('should remove the character and associated relations', async () => {
      await useWorldStore.getState().createCharacter('p1', 'Hero')
      const charId = 'test-id-1'

      await useWorldStore.getState().deleteCharacter(charId)

      expect(mockAdapter.deleteCharacter).toHaveBeenCalledWith(charId)
      expect(mockAdapter.deleteRelationsByCharacter).toHaveBeenCalledWith(charId)
      expect(mockAdapter.deleteVersionsByEntity).toHaveBeenCalledWith('character', charId)
      expect(useWorldStore.getState().characters).toHaveLength(0)
    })

    it('should clear selectedCharacterId if deleted character was selected', async () => {
      await useWorldStore.getState().createCharacter('p1', 'Hero')
      useWorldStore.getState().selectCharacter('test-id-1')
      expect(useWorldStore.getState().selectedCharacterId).toBe('test-id-1')

      await useWorldStore.getState().deleteCharacter('test-id-1')
      expect(useWorldStore.getState().selectedCharacterId).toBeNull()
    })

    it('should remove relations connected to the deleted character', async () => {
      await useWorldStore.getState().createCharacter('p1', 'Hero')
      await useWorldStore.getState().createCharacter('p1', 'Villain')
      await useWorldStore.getState().createRelation('p1', 'test-id-1', 'test-id-2', 'enemy')

      await useWorldStore.getState().deleteCharacter('test-id-1')

      expect(useWorldStore.getState().relations).toHaveLength(0)
    })
  })

  describe('selectCharacter', () => {
    it('should set selectedCharacterId', () => {
      useWorldStore.getState().selectCharacter('c1')
      expect(useWorldStore.getState().selectedCharacterId).toBe('c1')
    })

    it('should clear selection with null', () => {
      useWorldStore.getState().selectCharacter('c1')
      useWorldStore.getState().selectCharacter(null)
      expect(useWorldStore.getState().selectedCharacterId).toBeNull()
    })
  })

  // ── Relations ──

  describe('loadRelations', () => {
    it('should load relations from the adapter', async () => {
      const rels = [{ id: 'r1', projectId: 'p1', sourceId: 'c1', targetId: 'c2', relationType: 'friend' }]
      mockAdapter.fetchRelations.mockResolvedValueOnce(rels)

      await useWorldStore.getState().loadRelations('p1')
      expect(useWorldStore.getState().relations).toEqual(rels)
    })

    it('should set relations to empty array on error', async () => {
      mockAdapter.fetchRelations.mockRejectedValueOnce(new Error('fail'))
      await useWorldStore.getState().loadRelations('p1')
      expect(useWorldStore.getState().relations).toEqual([])
    })
  })

  describe('createRelation', () => {
    it('should create a new relation', async () => {
      const rel = await useWorldStore.getState().createRelation('p1', 'c1', 'c2', 'friend')

      expect(rel.id).toBe('test-id-1')
      expect(rel.sourceId).toBe('c1')
      expect(rel.targetId).toBe('c2')
      expect(rel.relationType).toBe('friend')
      expect(rel.isBidirectional).toBe(true)
      expect(mockAdapter.insertRelation).toHaveBeenCalledTimes(1)
      expect(useWorldStore.getState().relations).toHaveLength(1)
    })

    it('should update existing relation if same pair exists', async () => {
      await useWorldStore.getState().createRelation('p1', 'c1', 'c2', 'friend')

      // Create same pair with different type
      const existing = await useWorldStore.getState().createRelation('p1', 'c1', 'c2', 'enemy')

      expect(mockAdapter.updateRelation).toHaveBeenCalledWith('test-id-1', { relationType: 'enemy' })
      expect(useWorldStore.getState().relations).toHaveLength(1)
      expect(useWorldStore.getState().relations[0].relationType).toBe('enemy')
    })

    it('should detect reverse-direction duplicates', async () => {
      await useWorldStore.getState().createRelation('p1', 'c1', 'c2', 'friend')

      // Same pair reversed
      await useWorldStore.getState().createRelation('p1', 'c2', 'c1', 'rival')

      expect(useWorldStore.getState().relations).toHaveLength(1)
      expect(useWorldStore.getState().relations[0].relationType).toBe('rival')
    })
  })

  describe('updateRelation', () => {
    it('should update relation properties', async () => {
      await useWorldStore.getState().createRelation('p1', 'c1', 'c2', 'friend')

      await useWorldStore.getState().updateRelation('test-id-1', { description: 'Close friends' })

      expect(mockAdapter.updateRelation).toHaveBeenCalledWith('test-id-1', { description: 'Close friends' })
      expect(useWorldStore.getState().relations[0].description).toBe('Close friends')
    })
  })

  describe('deleteRelation', () => {
    it('should remove a relation', async () => {
      await useWorldStore.getState().createRelation('p1', 'c1', 'c2', 'friend')

      await useWorldStore.getState().deleteRelation('test-id-1')

      expect(mockAdapter.deleteRelation).toHaveBeenCalledWith('test-id-1')
      expect(mockAdapter.deleteVersionsByEntity).toHaveBeenCalledWith('relation', 'test-id-1')
      expect(useWorldStore.getState().relations).toHaveLength(0)
    })
  })

  // ── World Settings ──

  describe('loadWorldSettings', () => {
    it('should load world settings from the adapter', async () => {
      const settings = [{ id: 'ws1', projectId: 'p1', category: 'magic', title: 'Magic System' }]
      mockAdapter.fetchWorldSettings.mockResolvedValueOnce(settings)

      await useWorldStore.getState().loadWorldSettings('p1')
      expect(useWorldStore.getState().worldSettings).toEqual(settings)
    })

    it('should set worldSettings to empty array on error', async () => {
      mockAdapter.fetchWorldSettings.mockRejectedValueOnce(new Error('fail'))
      await useWorldStore.getState().loadWorldSettings('p1')
      expect(useWorldStore.getState().worldSettings).toEqual([])
    })
  })

  describe('createWorldSetting', () => {
    it('should create a world setting with correct properties', async () => {
      const ws = await useWorldStore.getState().createWorldSetting('p1', 'magic', 'Magic System')

      expect(ws.id).toBe('test-id-1')
      expect(ws.projectId).toBe('p1')
      expect(ws.category).toBe('magic')
      expect(ws.title).toBe('Magic System')
      expect(ws.order).toBe(0)
      expect(ws.content).toBe('')
      expect(ws.tags).toEqual([])
      expect(mockAdapter.insertWorldSetting).toHaveBeenCalledTimes(1)
    })

    it('should auto-increment order within the same category', async () => {
      await useWorldStore.getState().createWorldSetting('p1', 'magic', 'System 1')
      const ws2 = await useWorldStore.getState().createWorldSetting('p1', 'magic', 'System 2')

      expect(ws2.order).toBe(1)
    })

    it('should start order at 0 for different categories', async () => {
      await useWorldStore.getState().createWorldSetting('p1', 'magic', 'Magic')
      const ws2 = await useWorldStore.getState().createWorldSetting('p1', 'technology', 'Tech')

      expect(ws2.order).toBe(0)
    })
  })

  describe('updateWorldSetting', () => {
    it('should update a world setting', async () => {
      await useWorldStore.getState().createWorldSetting('p1', 'magic', 'Magic')

      await useWorldStore.getState().updateWorldSetting('test-id-1', { title: 'Updated Magic' })

      expect(mockAdapter.updateWorldSetting).toHaveBeenCalledWith('test-id-1', expect.objectContaining({
        title: 'Updated Magic',
        updatedAt: 1700000000000,
      }))
      expect(useWorldStore.getState().worldSettings[0].title).toBe('Updated Magic')
    })
  })

  describe('deleteWorldSetting', () => {
    it('should remove a world setting', async () => {
      await useWorldStore.getState().createWorldSetting('p1', 'magic', 'Magic')

      await useWorldStore.getState().deleteWorldSetting('test-id-1')

      expect(mockAdapter.deleteWorldSetting).toHaveBeenCalledWith('test-id-1')
      expect(mockAdapter.deleteVersionsByEntity).toHaveBeenCalledWith('world_setting', 'test-id-1')
      expect(useWorldStore.getState().worldSettings).toHaveLength(0)
    })
  })

  // ── Items ──

  describe('loadItems', () => {
    it('should load items from the adapter', async () => {
      const items = [{ id: 'i1', projectId: 'p1', name: 'Sword' }]
      mockAdapter.fetchItems.mockResolvedValueOnce(items)

      await useWorldStore.getState().loadItems('p1')
      expect(useWorldStore.getState().items).toEqual(items)
    })

    it('should set items to empty array on error', async () => {
      mockAdapter.fetchItems.mockRejectedValueOnce(new Error('fail'))
      await useWorldStore.getState().loadItems('p1')
      expect(useWorldStore.getState().items).toEqual([])
    })
  })

  describe('createItem', () => {
    it('should create an item with correct defaults', async () => {
      const item = await useWorldStore.getState().createItem('p1', 'Magic Sword')

      expect(item.id).toBe('test-id-1')
      expect(item.name).toBe('Magic Sword')
      expect(item.itemType).toBe('other')
      expect(item.rarity).toBe('common')
      expect(item.order).toBe(0)
      expect(item.tags).toEqual([])
      expect(mockAdapter.insertItem).toHaveBeenCalledTimes(1)
    })

    it('should auto-increment order', async () => {
      await useWorldStore.getState().createItem('p1', 'Sword')
      const item2 = await useWorldStore.getState().createItem('p1', 'Shield')
      expect(item2.order).toBe(1)
    })
  })

  describe('updateItem', () => {
    it('should update an item', async () => {
      await useWorldStore.getState().createItem('p1', 'Sword')

      await useWorldStore.getState().updateItem('test-id-1', { name: 'Fire Sword' })

      expect(useWorldStore.getState().items[0].name).toBe('Fire Sword')
    })
  })

  describe('deleteItem', () => {
    it('should remove an item', async () => {
      await useWorldStore.getState().createItem('p1', 'Sword')

      await useWorldStore.getState().deleteItem('test-id-1')

      expect(mockAdapter.deleteItem).toHaveBeenCalledWith('test-id-1')
      expect(mockAdapter.deleteVersionsByEntity).toHaveBeenCalledWith('item', 'test-id-1')
      expect(useWorldStore.getState().items).toHaveLength(0)
    })

    it('should clear selectedItemId if deleted item was selected', async () => {
      await useWorldStore.getState().createItem('p1', 'Sword')
      useWorldStore.getState().selectItem('test-id-1')

      await useWorldStore.getState().deleteItem('test-id-1')
      expect(useWorldStore.getState().selectedItemId).toBeNull()
    })
  })

  describe('selectItem', () => {
    it('should set selectedItemId', () => {
      useWorldStore.getState().selectItem('i1')
      expect(useWorldStore.getState().selectedItemId).toBe('i1')
    })

    it('should clear selection with null', () => {
      useWorldStore.getState().selectItem('i1')
      useWorldStore.getState().selectItem(null)
      expect(useWorldStore.getState().selectedItemId).toBeNull()
    })
  })

  // ── Reference Data ──

  describe('loadReferenceData', () => {
    it('should load reference data from the adapter', async () => {
      const refs = [{ id: 'r1', projectId: 'p1', title: 'Ref 1' }]
      mockAdapter.fetchReferenceData.mockResolvedValueOnce(refs)

      await useWorldStore.getState().loadReferenceData('p1')
      expect(useWorldStore.getState().referenceData).toEqual(refs)
    })

    it('should set referenceData to empty array on error', async () => {
      mockAdapter.fetchReferenceData.mockRejectedValueOnce(new Error('fail'))
      await useWorldStore.getState().loadReferenceData('p1')
      expect(useWorldStore.getState().referenceData).toEqual([])
    })
  })

  describe('createReferenceData', () => {
    it('should create reference data with correct defaults', async () => {
      const ref = await useWorldStore.getState().createReferenceData('p1', 'reference', 'My Ref')

      expect(ref.id).toBe('test-id-1')
      expect(ref.category).toBe('reference')
      expect(ref.title).toBe('My Ref')
      expect(ref.useAsContext).toBe(true)
      expect(ref.attachments).toEqual([])
      expect(ref.order).toBe(0)
      expect(mockAdapter.insertReferenceData).toHaveBeenCalledTimes(1)
    })

    it('should auto-increment order', async () => {
      await useWorldStore.getState().createReferenceData('p1', 'reference', 'Ref 1')
      const ref2 = await useWorldStore.getState().createReferenceData('p1', 'style_sample', 'Ref 2')
      expect(ref2.order).toBe(1)
    })
  })

  describe('updateReferenceData', () => {
    it('should update reference data', async () => {
      await useWorldStore.getState().createReferenceData('p1', 'reference', 'Ref')

      await useWorldStore.getState().updateReferenceData('test-id-1', { title: 'Updated Ref' })

      expect(useWorldStore.getState().referenceData[0].title).toBe('Updated Ref')
    })
  })

  describe('deleteReferenceData', () => {
    it('should remove reference data', async () => {
      await useWorldStore.getState().createReferenceData('p1', 'reference', 'Ref')

      await useWorldStore.getState().deleteReferenceData('test-id-1')

      expect(mockAdapter.deleteReferenceData).toHaveBeenCalledWith('test-id-1')
      expect(mockAdapter.deleteVersionsByEntity).toHaveBeenCalledWith('reference_data', 'test-id-1')
      expect(useWorldStore.getState().referenceData).toHaveLength(0)
    })

    it('should clear selectedReferenceId if deleted reference was selected', async () => {
      await useWorldStore.getState().createReferenceData('p1', 'reference', 'Ref')
      useWorldStore.getState().selectReference('test-id-1')

      await useWorldStore.getState().deleteReferenceData('test-id-1')
      expect(useWorldStore.getState().selectedReferenceId).toBeNull()
    })
  })

  describe('selectReference', () => {
    it('should set selectedReferenceId', () => {
      useWorldStore.getState().selectReference('r1')
      expect(useWorldStore.getState().selectedReferenceId).toBe('r1')
    })

    it('should clear selection with null', () => {
      useWorldStore.getState().selectReference('r1')
      useWorldStore.getState().selectReference(null)
      expect(useWorldStore.getState().selectedReferenceId).toBeNull()
    })
  })

  // ── Foreshadows ──

  describe('loadForeshadows', () => {
    it('should load foreshadows from the adapter', async () => {
      const fs = [{ id: 'f1', projectId: 'p1', title: 'Hint' }]
      mockAdapter.fetchForeshadows.mockResolvedValueOnce(fs)

      await useWorldStore.getState().loadForeshadows('p1')
      expect(useWorldStore.getState().foreshadows).toEqual(fs)
    })

    it('should set foreshadows to empty array on error', async () => {
      mockAdapter.fetchForeshadows.mockRejectedValueOnce(new Error('fail'))
      await useWorldStore.getState().loadForeshadows('p1')
      expect(useWorldStore.getState().foreshadows).toEqual([])
    })
  })

  describe('createForeshadow', () => {
    it('should create a foreshadow with correct defaults', async () => {
      const fs = await useWorldStore.getState().createForeshadow('p1', 'Mystery Hint')

      expect(fs.id).toBe('test-id-1')
      expect(fs.title).toBe('Mystery Hint')
      expect(fs.status).toBe('planted')
      expect(fs.importance).toBe('medium')
      expect(fs.plantedChapterId).toBeNull()
      expect(fs.resolvedChapterId).toBeNull()
      expect(fs.tags).toEqual([])
      expect(mockAdapter.insertForeshadow).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateForeshadow', () => {
    it('should update a foreshadow', async () => {
      await useWorldStore.getState().createForeshadow('p1', 'Hint')

      await useWorldStore.getState().updateForeshadow('test-id-1', { status: 'resolved' })

      expect(useWorldStore.getState().foreshadows[0].status).toBe('resolved')
    })
  })

  describe('deleteForeshadow', () => {
    it('should remove a foreshadow', async () => {
      await useWorldStore.getState().createForeshadow('p1', 'Hint')

      await useWorldStore.getState().deleteForeshadow('test-id-1')

      expect(mockAdapter.deleteForeshadow).toHaveBeenCalledWith('test-id-1')
      expect(mockAdapter.deleteVersionsByEntity).toHaveBeenCalledWith('foreshadow', 'test-id-1')
      expect(useWorldStore.getState().foreshadows).toHaveLength(0)
    })
  })

  // ── loadAll ──

  describe('loadAll', () => {
    it('should clean orphaned relations and load all data', async () => {
      await useWorldStore.getState().loadAll('p1')

      expect(mockAdapter.cleanOrphanedRelations).toHaveBeenCalledWith('p1')
      expect(mockAdapter.fetchCharacters).toHaveBeenCalledWith('p1')
      expect(mockAdapter.fetchRelations).toHaveBeenCalledWith('p1')
      expect(mockAdapter.fetchWorldSettings).toHaveBeenCalledWith('p1')
      expect(mockAdapter.fetchItems).toHaveBeenCalledWith('p1')
      expect(mockAdapter.fetchReferenceData).toHaveBeenCalledWith('p1')
      expect(mockAdapter.fetchForeshadows).toHaveBeenCalledWith('p1')
    })

    it('should still load data even if cleanOrphanedRelations fails', async () => {
      mockAdapter.cleanOrphanedRelations.mockRejectedValueOnce(new Error('fail'))

      await useWorldStore.getState().loadAll('p1')

      expect(mockAdapter.fetchCharacters).toHaveBeenCalledWith('p1')
      expect(mockAdapter.fetchRelations).toHaveBeenCalledWith('p1')
    })
  })
})
