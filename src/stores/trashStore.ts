import { create } from 'zustand'
import { getAdapter } from '@/db/storageAdapter'
import type { TrashItem, TrashEntityType } from '@/types'
import { generateId } from '@/lib/utils'
import { nowUTC } from '@/lib/dateUtils'

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

interface TrashState {
  items: TrashItem[]
  loading: boolean

  loadTrash: (projectId: string) => Promise<void>
  moveToTrash: (projectId: string, entityType: TrashEntityType, entityId: string, entityData: Record<string, any>, relatedData?: Record<string, any>) => Promise<void>
  restoreFromTrash: (trashItemId: string) => Promise<TrashItem | null>
  permanentlyDelete: (trashItemId: string) => Promise<void>
  emptyTrash: (projectId: string) => Promise<void>
  purgeExpired: () => Promise<number>
}

export const useTrashStore = create<TrashState>((set, get) => ({
  items: [],
  loading: false,

  loadTrash: async (projectId: string) => {
    set({ loading: true })
    try {
      const items = await getAdapter().fetchTrashItems(projectId)
      set({ items, loading: false })
    } catch (error) {
      console.error('[Trash] Failed to load trash items:', error)
      set({ items: [], loading: false })
    }
  },

  moveToTrash: async (projectId, entityType, entityId, entityData, relatedData) => {
    const now = nowUTC()
    const item: TrashItem = {
      id: generateId(),
      projectId,
      entityType,
      entityId,
      entityData,
      relatedData,
      deletedAt: now,
      expiresAt: now + THIRTY_DAYS_MS,
    }
    await getAdapter().insertTrashItem(item)
    set(s => ({ items: [item, ...s.items] }))
  },

  restoreFromTrash: async (trashItemId) => {
    const item = get().items.find(i => i.id === trashItemId)
    if (!item) return null

    const adapter = getAdapter()
    const data = item.entityData as any

    // Re-insert into original table
    switch (item.entityType) {
      case 'wiki_entry':
        await adapter.insertWikiEntry(data)
        break
      case 'canvas_node':
        await adapter.insertCanvasNode(data)
        // Restore related wires
        if (item.relatedData?.wires) {
          for (const wire of item.relatedData.wires) {
            await adapter.insertCanvasWire(wire)
          }
        }
        break
      case 'character':
        await adapter.insertCharacter(data)
        break
      case 'chapter':
        await adapter.insertChapter(data)
        break
      case 'world_setting':
        await adapter.insertWorldSetting(data)
        break
      case 'item':
        await adapter.insertItem(data)
        break
      case 'reference_data':
        await adapter.insertReferenceData(data)
        break
      case 'foreshadow':
        await adapter.insertForeshadow(data)
        break
    }

    // Remove from trash
    await adapter.deleteTrashItem(trashItemId)
    set(s => ({ items: s.items.filter(i => i.id !== trashItemId) }))
    return item
  },

  permanentlyDelete: async (trashItemId) => {
    await getAdapter().deleteTrashItem(trashItemId)
    set(s => ({ items: s.items.filter(i => i.id !== trashItemId) }))
  },

  emptyTrash: async (projectId) => {
    await getAdapter().deleteTrashByProject(projectId)
    set({ items: [] })
  },

  purgeExpired: async () => {
    const count = await getAdapter().purgeExpiredTrash()
    if (count > 0) {
      // Reload to sync state
      const { items } = get()
      const now = nowUTC()
      set({ items: items.filter(i => i.expiresAt > now) })
    }
    return count
  },
}))
