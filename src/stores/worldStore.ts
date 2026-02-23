import { create } from 'zustand'
import { getAdapter } from '@/db/storageAdapter'
import type { Character, CharacterRelation, WorldSetting, WorldSettingCategory, Foreshadow, Item, ReferenceData, ReferenceCategory } from '@/types'
import { generateId } from '@/lib/utils'
import { nowUTC } from '@/lib/dateUtils'
import { createEntity, withUpdatedAt, mapUpdate } from '@/lib/storeHelpers'

interface WorldState {
  characters: Character[]
  relations: CharacterRelation[]
  worldSettings: WorldSetting[]
  foreshadows: Foreshadow[]
  items: Item[]
  referenceData: ReferenceData[]
  selectedCharacterId: string | null
  selectedItemId: string | null
  selectedReferenceId: string | null

  loadCharacters: (projectId: string) => Promise<void>
  createCharacter: (projectId: string, name: string) => Promise<Character>
  updateCharacter: (id: string, updates: Partial<Character>) => Promise<void>
  deleteCharacter: (id: string) => Promise<void>
  selectCharacter: (id: string | null) => void

  loadRelations: (projectId: string) => Promise<void>
  createRelation: (projectId: string, sourceId: string, targetId: string, relationType: string) => Promise<CharacterRelation>
  updateRelation: (id: string, updates: Partial<CharacterRelation>) => Promise<void>
  deleteRelation: (id: string) => Promise<void>

  loadWorldSettings: (projectId: string) => Promise<void>
  createWorldSetting: (projectId: string, category: WorldSettingCategory, title: string) => Promise<WorldSetting>
  updateWorldSetting: (id: string, updates: Partial<WorldSetting>) => Promise<void>
  deleteWorldSetting: (id: string) => Promise<void>

  loadItems: (projectId: string) => Promise<void>
  createItem: (projectId: string, name: string) => Promise<Item>
  updateItem: (id: string, updates: Partial<Item>) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  selectItem: (id: string | null) => void

  loadReferenceData: (projectId: string) => Promise<void>
  createReferenceData: (projectId: string, category: ReferenceCategory, title: string) => Promise<ReferenceData>
  updateReferenceData: (id: string, updates: Partial<ReferenceData>) => Promise<void>
  deleteReferenceData: (id: string) => Promise<void>
  selectReference: (id: string | null) => void

  loadForeshadows: (projectId: string) => Promise<void>
  createForeshadow: (projectId: string, title: string) => Promise<Foreshadow>
  updateForeshadow: (id: string, updates: Partial<Foreshadow>) => Promise<void>
  deleteForeshadow: (id: string) => Promise<void>

  loadAll: (projectId: string) => Promise<void>
}

export const useWorldStore = create<WorldState>((set, get) => ({
  characters: [],
  relations: [],
  worldSettings: [],
  foreshadows: [],
  items: [],
  referenceData: [],
  selectedCharacterId: null,
  selectedItemId: null,
  selectedReferenceId: null,

  loadAll: async (projectId: string) => {
    try {
      const cleaned = await getAdapter().cleanOrphanedRelations(projectId)
      if (cleaned > 0) { /* orphaned relations cleaned */ }
    } catch (e) {
      console.error('[WorldStore] Failed to clean orphaned relations:', e)
    }

    await Promise.all([
      get().loadCharacters(projectId),
      get().loadRelations(projectId),
      get().loadWorldSettings(projectId),
      get().loadItems(projectId),
      get().loadReferenceData(projectId),
      get().loadForeshadows(projectId),
    ])
  },

  // ── Characters ──
  loadCharacters: async (projectId) => {
    try {
      const characters = await getAdapter().fetchCharacters(projectId)
      set({ characters })
    } catch (error) {
      console.error('[Characters] Failed to load characters:', error)
      set({ characters: [] })
    }
  },

  createCharacter: async (projectId, name) => {
    const character: Character = {
      id: generateId(),
      projectId,
      name,
      aliases: [],
      role: 'supporting',
      position: 'neutral',
      personality: '',
      abilities: '',
      appearance: '',
      background: '',
      motivation: '',
      speechPattern: '',
      imageUrl: '',
      tags: [],
      notes: '',
      createdAt: nowUTC(),
      updatedAt: nowUTC(),
    }
    await getAdapter().insertCharacter(character)
    set(s => ({ characters: [...s.characters, character] }))
    return character
  },

  updateCharacter: async (id, updates) => {
    const merged = withUpdatedAt(updates)
    await getAdapter().updateCharacter(id, merged)
    set(s => ({ characters: mapUpdate(s.characters, id, merged) }))
  },

  deleteCharacter: async (id) => {
    await getAdapter().deleteCharacter(id)
    await getAdapter().deleteRelationsByCharacter(id)
    await getAdapter().deleteVersionsByEntity('character', id)
    set(s => ({
      characters: s.characters.filter(c => c.id !== id),
      relations: s.relations.filter(r => r.sourceId !== id && r.targetId !== id),
      selectedCharacterId: s.selectedCharacterId === id ? null : s.selectedCharacterId,
    }))
  },

  selectCharacter: (id) => set({ selectedCharacterId: id }),

  // ── Relations ──
  loadRelations: async (projectId) => {
    try {
      const relations = await getAdapter().fetchRelations(projectId)
      set({ relations })
    } catch (error) {
      console.error('[Relations] Failed to load relations:', error)
      set({ relations: [] })
    }
  },

  createRelation: async (projectId, sourceId, targetId, relationType) => {
    const existingRelation = get().relations.find(r =>
      r.projectId === projectId &&
      ((r.sourceId === sourceId && r.targetId === targetId) ||
       (r.sourceId === targetId && r.targetId === sourceId))
    )
    if (existingRelation) {
      await getAdapter().updateRelation(existingRelation.id, { relationType })
      set(s => ({
        relations: s.relations.map(r => r.id === existingRelation.id ? { ...r, relationType } : r),
      }))
      return existingRelation
    }

    const relation: CharacterRelation = {
      id: generateId(),
      projectId,
      sourceId,
      targetId,
      relationType,
      description: '',
      isBidirectional: true,
    }
    await getAdapter().insertRelation(relation)
    set(s => ({ relations: [...s.relations, relation] }))
    return relation
  },

  updateRelation: async (id, updates) => {
    await getAdapter().updateRelation(id, updates)
    set(s => ({ relations: mapUpdate(s.relations, id, updates) }))
  },

  deleteRelation: async (id) => {
    await getAdapter().deleteRelation(id)
    await getAdapter().deleteVersionsByEntity('relation', id)
    set(s => ({ relations: s.relations.filter(r => r.id !== id) }))
  },

  // ── World Settings ──
  loadWorldSettings: async (projectId) => {
    try {
      const worldSettings = await getAdapter().fetchWorldSettings(projectId)
      set({ worldSettings })
    } catch (error) {
      console.error('[WorldSettings] Failed to load world settings:', error)
      set({ worldSettings: [] })
    }
  },

  createWorldSetting: async (projectId, category, title) => {
    const existing = get().worldSettings.filter(w => w.category === category)
    const maxOrder = existing.length > 0 ? Math.max(...existing.map(w => w.order)) + 1 : 0
    const ws: WorldSetting = {
      id: generateId(),
      projectId,
      category,
      title,
      content: '',
      tags: [],
      order: maxOrder,
      createdAt: nowUTC(),
      updatedAt: nowUTC(),
    }
    await getAdapter().insertWorldSetting(ws)
    set(s => ({ worldSettings: [...s.worldSettings, ws] }))
    return ws
  },

  updateWorldSetting: async (id, updates) => {
    const merged = withUpdatedAt(updates)
    await getAdapter().updateWorldSetting(id, merged)
    set(s => ({ worldSettings: mapUpdate(s.worldSettings, id, merged) }))
  },

  deleteWorldSetting: async (id) => {
    await getAdapter().deleteWorldSetting(id)
    await getAdapter().deleteVersionsByEntity('world_setting', id)
    set(s => ({ worldSettings: s.worldSettings.filter(w => w.id !== id) }))
  },

  // ── Items ──
  loadItems: async (projectId) => {
    try {
      const items = await getAdapter().fetchItems(projectId)
      set({ items })
    } catch (error) {
      console.error('[Items] Failed to load items:', error)
      set({ items: [] })
    }
  },

  createItem: async (projectId, name) => {
    const existing = get().items
    const maxOrder = existing.length > 0 ? Math.max(...existing.map(i => i.order)) + 1 : 0
    const item: Item = {
      id: generateId(),
      projectId,
      name,
      itemType: 'other',
      rarity: 'common',
      effect: '',
      description: '',
      owner: '',
      tags: [],
      notes: '',
      order: maxOrder,
      createdAt: nowUTC(),
      updatedAt: nowUTC(),
    }
    await getAdapter().insertItem(item)
    set(s => ({ items: [...s.items, item] }))
    return item
  },

  updateItem: async (id, updates) => {
    const merged = withUpdatedAt(updates)
    await getAdapter().updateItem(id, merged)
    set(s => ({ items: mapUpdate(s.items, id, merged) }))
  },

  deleteItem: async (id) => {
    await getAdapter().deleteItem(id)
    await getAdapter().deleteVersionsByEntity('item', id)
    set(s => ({
      items: s.items.filter(i => i.id !== id),
      selectedItemId: s.selectedItemId === id ? null : s.selectedItemId,
    }))
  },

  selectItem: (id) => set({ selectedItemId: id }),

  // ── Reference Data ──
  loadReferenceData: async (projectId) => {
    try {
      const referenceData = await getAdapter().fetchReferenceData(projectId)
      set({ referenceData })
    } catch (error) {
      console.error('[ReferenceData] Failed to load reference data:', error)
      set({ referenceData: [] })
    }
  },

  createReferenceData: async (projectId, category, title) => {
    const existing = get().referenceData
    const maxOrder = existing.length > 0 ? Math.max(...existing.map(r => r.order)) + 1 : 0
    const ref: ReferenceData = {
      id: generateId(),
      projectId,
      category,
      title,
      content: '',
      sourceUrl: '',
      attachments: [],
      tags: [],
      useAsContext: true,
      notes: '',
      order: maxOrder,
      createdAt: nowUTC(),
      updatedAt: nowUTC(),
    }
    await getAdapter().insertReferenceData(ref)
    set(s => ({ referenceData: [...s.referenceData, ref] }))
    return ref
  },

  updateReferenceData: async (id, updates) => {
    const merged = withUpdatedAt(updates)
    await getAdapter().updateReferenceData(id, merged)
    set(s => ({ referenceData: mapUpdate(s.referenceData, id, merged) }))
  },

  deleteReferenceData: async (id) => {
    await getAdapter().deleteReferenceData(id)
    await getAdapter().deleteVersionsByEntity('reference_data', id)
    set(s => ({
      referenceData: s.referenceData.filter(r => r.id !== id),
      selectedReferenceId: s.selectedReferenceId === id ? null : s.selectedReferenceId,
    }))
  },

  selectReference: (id) => set({ selectedReferenceId: id }),

  // ── Foreshadows ──
  loadForeshadows: async (projectId) => {
    try {
      const foreshadows = await getAdapter().fetchForeshadows(projectId)
      set({ foreshadows })
    } catch (error) {
      console.error('[Foreshadows] Failed to load foreshadows:', error)
      set({ foreshadows: [] })
    }
  },

  createForeshadow: async (projectId, title) => {
    const fs: Foreshadow = {
      id: generateId(),
      projectId,
      title,
      description: '',
      status: 'planted',
      plantedChapterId: null,
      resolvedChapterId: null,
      importance: 'medium',
      tags: [],
      notes: '',
      createdAt: nowUTC(),
      updatedAt: nowUTC(),
    }
    await getAdapter().insertForeshadow(fs)
    set(s => ({ foreshadows: [...s.foreshadows, fs] }))
    return fs
  },

  updateForeshadow: async (id, updates) => {
    const merged = withUpdatedAt(updates)
    await getAdapter().updateForeshadow(id, merged)
    set(s => ({ foreshadows: mapUpdate(s.foreshadows, id, merged) }))
  },

  deleteForeshadow: async (id) => {
    await getAdapter().deleteForeshadow(id)
    await getAdapter().deleteVersionsByEntity('foreshadow', id)
    set(s => ({ foreshadows: s.foreshadows.filter(f => f.id !== id) }))
  },
}))
