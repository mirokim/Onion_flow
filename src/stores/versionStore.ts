import { create } from 'zustand'
import { getAdapter } from '@/db/storageAdapter'
import type { EntityVersion, EntityType, TimelineSnapshot } from '@/types'
import { generateId } from '@/lib/utils'
import { nowUTC } from '@/lib/dateUtils'

interface VersionState {
  versions: EntityVersion[]
  timelineSnapshots: TimelineSnapshot[]
  loading: boolean

  // Entity versions
  loadVersions: (projectId: string, entityType?: EntityType, entityId?: string) => Promise<void>
  createVersion: (params: {
    projectId: string
    entityType: EntityType
    entityId: string
    data: any
    label: string
    createdBy: 'user' | 'ai'
  }) => Promise<EntityVersion>
  deleteVersion: (id: string) => Promise<void>

  // Timeline snapshots
  loadTimelineSnapshots: (projectId: string) => Promise<void>
  createTimelineSnapshot: (projectId: string, label: string) => Promise<TimelineSnapshot>
  restoreTimelineSnapshot: (snapshotId: string) => Promise<void>
  deleteTimelineSnapshot: (id: string) => Promise<void>
}

export const useVersionStore = create<VersionState>((set, get) => ({
  versions: [],
  timelineSnapshots: [],
  loading: false,

  loadVersions: async (projectId, entityType, entityId) => {
    set({ loading: true })
    const adapter = getAdapter()
    const versions = await adapter.fetchVersions(projectId, entityType, entityId)
    set({ versions, loading: false })
  },

  createVersion: async ({ projectId, entityType, entityId, data, label, createdBy }) => {
    const adapter = getAdapter()
    const maxNum = await adapter.getMaxVersionNumber(entityType, entityId)
    const version: EntityVersion = {
      id: generateId(),
      projectId,
      entityType,
      entityId,
      versionNumber: maxNum + 1,
      data,
      label,
      createdBy,
      createdAt: nowUTC(),
    }
    await adapter.insertVersion(version)
    set(s => ({ versions: [version, ...s.versions] }))
    return version
  },

  deleteVersion: async (id) => {
    const adapter = getAdapter()
    await adapter.deleteVersion(id)
    set(s => ({ versions: s.versions.filter(v => v.id !== id) }))
  },

  // ── Timeline Snapshots ──

  loadTimelineSnapshots: async (projectId) => {
    set({ loading: true })
    const adapter = getAdapter()
    const snapshots = await adapter.fetchTimelineSnapshots(projectId)
    set({ timelineSnapshots: snapshots, loading: false })
  },

  createTimelineSnapshot: async (projectId, label) => {
    const adapter = getAdapter()

    // Collect current state from all stores
    const { useProjectStore } = await import('./projectStore')
    const { useCanvasStore } = await import('./canvasStore')
    const { useWikiStore } = await import('./wikiStore')
    const { useWorldStore } = await import('./worldStore')

    const chapters = useProjectStore.getState().chapters
    const canvasState = useCanvasStore.getState().exportCanvas()
    const wikiEntries = useWikiStore.getState().entries
    const world = useWorldStore.getState()

    const snapshot: TimelineSnapshot = {
      id: generateId(),
      projectId,
      label,
      canvasData: JSON.stringify({
        nodes: canvasState.nodes,
        wires: canvasState.wires,
      }),
      manuscriptData: JSON.stringify(chapters),
      wikiData: JSON.stringify(wikiEntries),
      worldData: JSON.stringify({
        characters: world.characters,
        relations: world.relations,
        worldSettings: world.worldSettings,
        foreshadows: world.foreshadows,
        items: world.items,
      }),
      createdAt: nowUTC(),
    }

    await adapter.insertTimelineSnapshot(snapshot)
    set(s => ({ timelineSnapshots: [snapshot, ...s.timelineSnapshots] }))
    return snapshot
  },

  restoreTimelineSnapshot: async (snapshotId) => {
    const snapshot = get().timelineSnapshots.find(s => s.id === snapshotId)
    if (!snapshot) return

    const adapter = getAdapter()
    const projectId = snapshot.projectId

    // Parse snapshot data
    const canvasData = JSON.parse(snapshot.canvasData)
    const chapters = JSON.parse(snapshot.manuscriptData)
    const wikiEntries = JSON.parse(snapshot.wikiData)
    const worldData = JSON.parse(snapshot.worldData)

    // Use a transaction to restore atomically
    await adapter.transaction(async () => {
      // Clear existing data
      await adapter.deleteChaptersByProject(projectId)
      await adapter.deleteCanvasNodesByProject(projectId)
      await adapter.deleteCanvasWiresByProject(projectId)
      await adapter.deleteWikiEntriesByProject(projectId)

      // Clear world data
      const sqlAdapter = adapter as any
      if (sqlAdapter.deleteCharactersByProject) await sqlAdapter.deleteCharactersByProject(projectId)
      if (sqlAdapter.deleteRelationsByProject) await sqlAdapter.deleteRelationsByProject(projectId)
      if (sqlAdapter.deleteWorldSettingsByProject) await sqlAdapter.deleteWorldSettingsByProject(projectId)
      if (sqlAdapter.deleteForeshadowsByProject) await sqlAdapter.deleteForeshadowsByProject(projectId)
      if (sqlAdapter.deleteItemsByProject) await sqlAdapter.deleteItemsByProject(projectId)

      // Restore chapters
      for (const ch of chapters) {
        await adapter.insertChapter(ch)
      }

      // Restore canvas nodes and wires
      for (const node of canvasData.nodes) {
        await adapter.insertCanvasNode(node)
      }
      for (const wire of canvasData.wires) {
        await adapter.insertCanvasWire(wire)
      }

      // Restore wiki entries
      for (const entry of wikiEntries) {
        await adapter.insertWikiEntry(entry)
      }

      // Restore world data
      for (const ch of worldData.characters || []) {
        await adapter.insertCharacter(ch)
      }
      for (const rel of worldData.relations || []) {
        await adapter.insertRelation(rel)
      }
      for (const ws of worldData.worldSettings || []) {
        await adapter.insertWorldSetting(ws)
      }
      for (const fs of worldData.foreshadows || []) {
        await adapter.insertForeshadow(fs)
      }
      for (const item of worldData.items || []) {
        await adapter.insertItem(item)
      }
    })

    // Reload all stores
    const { useProjectStore } = await import('./projectStore')
    const { useCanvasStore } = await import('./canvasStore')
    const { useWikiStore } = await import('./wikiStore')
    const { useWorldStore } = await import('./worldStore')

    await Promise.all([
      useProjectStore.getState().loadChapters(projectId),
      useCanvasStore.getState().loadCanvas(projectId),
      useWikiStore.getState().loadEntries(projectId),
      useWorldStore.getState().loadAll(projectId),
    ])
  },

  deleteTimelineSnapshot: async (id) => {
    const adapter = getAdapter()
    await adapter.deleteTimelineSnapshot(id)
    set(s => ({ timelineSnapshots: s.timelineSnapshots.filter(snap => snap.id !== id) }))
  },
}))
