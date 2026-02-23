import { create } from 'zustand'
import { getAdapter } from '@/db/storageAdapter'
import type { WikiEntry, WikiCategory, WikiFilterCategory, EntityType } from '@/types'
import { CATEGORY_GROUP_MAP } from '@/components/wiki/WikiCategoryList'
import { generateId } from '@/lib/utils'
import { nowUTC } from '@/lib/dateUtils'
import { createEntity, withUpdatedAt, mapUpdate } from '@/lib/storeHelpers'

interface WikiState {
  entries: WikiEntry[]
  selectedEntryId: string | null
  searchQuery: string
  filterCategory: WikiFilterCategory
  loading: boolean

  // CRUD
  loadEntries: (projectId: string) => Promise<void>
  createEntry: (projectId: string, category: WikiCategory, title: string) => Promise<WikiEntry>
  updateEntry: (id: string, updates: Partial<WikiEntry>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  selectEntry: (id: string | null) => void

  // Linked entries (sync with Characters, WorldSettings, Items)
  createLinkedEntry: (projectId: string, entityId: string, entityType: EntityType, category: WikiCategory, title: string, content: string) => Promise<WikiEntry>
  findLinkedEntry: (entityId: string, entityType: EntityType) => WikiEntry | undefined

  // Search & filter
  setSearchQuery: (query: string) => void
  setFilterCategory: (category: WikiFilterCategory) => void
  getFilteredEntries: () => WikiEntry[]
}

export const useWikiStore = create<WikiState>((set, get) => ({
  entries: [],
  selectedEntryId: null,
  searchQuery: '',
  filterCategory: 'all',
  loading: false,

  loadEntries: async (projectId: string) => {
    set({ loading: true })
    try {
      const entries = await getAdapter().fetchWikiEntries(projectId)
      set({ entries, loading: false })
    } catch (error) {
      console.error('[Wiki] Failed to load entries:', error)
      set({ entries: [], loading: false })
    }
  },

  createEntry: async (projectId, category, title) => {
    const existing = get().entries
    const maxOrder = existing.length > 0 ? Math.max(...existing.map(e => e.order)) + 1 : 0
    const entry: WikiEntry = {
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
    await getAdapter().insertWikiEntry(entry)
    set(s => ({ entries: [...s.entries, entry] }))
    return entry
  },

  updateEntry: async (id, updates) => {
    const merged = withUpdatedAt(updates)
    await getAdapter().updateWikiEntry(id, merged)
    set(s => ({ entries: mapUpdate(s.entries, id, merged) }))
  },

  deleteEntry: async (id) => {
    await getAdapter().deleteWikiEntry(id)
    set(s => ({
      entries: s.entries.filter(e => e.id !== id),
      selectedEntryId: s.selectedEntryId === id ? null : s.selectedEntryId,
    }))
  },

  selectEntry: (id) => set({ selectedEntryId: id }),

  createLinkedEntry: async (projectId, entityId, entityType, category, title, content) => {
    const existing = get().entries
    const maxOrder = existing.length > 0 ? Math.max(...existing.map(e => e.order)) + 1 : 0
    const entry: WikiEntry = {
      id: generateId(),
      projectId,
      category,
      title,
      content,
      tags: [],
      linkedEntityId: entityId,
      linkedEntityType: entityType,
      order: maxOrder,
      createdAt: nowUTC(),
      updatedAt: nowUTC(),
    }
    await getAdapter().insertWikiEntry(entry)
    set(s => ({ entries: [...s.entries, entry] }))
    return entry
  },

  findLinkedEntry: (entityId, entityType) => {
    return get().entries.find(e => e.linkedEntityId === entityId && e.linkedEntityType === entityType)
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterCategory: (category) => set({ filterCategory: category }),

  getFilteredEntries: () => {
    const { entries, searchQuery, filterCategory } = get()
    let filtered = entries
    if (filterCategory !== 'all') {
      const groupCategories = CATEGORY_GROUP_MAP[filterCategory]
      if (groupCategories) {
        const groupSet = new Set(groupCategories)
        filtered = filtered.filter(e => groupSet.has(e.category))
      } else {
        filtered = filtered.filter(e => e.category === filterCategory)
      }
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().includes(q) ||
        e.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return filtered.sort((a, b) => a.order - b.order)
  },
}))
