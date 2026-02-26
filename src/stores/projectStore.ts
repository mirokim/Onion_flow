import { create } from 'zustand'
import { getAdapter } from '@/db/storageAdapter'
import type { Project, Chapter, ChapterTreeItem } from '@/types'
import { generateId } from '@/lib/utils'
import { nowUTC } from '@/lib/dateUtils'
import { createEntity, withUpdatedAt, mapUpdate } from '@/lib/storeHelpers'
import type { JSONContent } from '@tiptap/react'
import { useEditorStore } from './editorStore'
import type { StoryFlowFile } from '@/db/projectSerializer'

interface DeletedChapterEntry {
  chapter: Chapter
  children: Chapter[]
  deletedAt: number
}

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  chapters: Chapter[]
  currentChapter: Chapter | null
  deletedChapterStack: DeletedChapterEntry[]
  undoToastVisible: boolean

  // Project actions
  loadProjects: () => Promise<void>
  createProject: (title: string) => Promise<Project>
  selectProject: (id: string) => Promise<void>
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>

  // Chapter actions
  loadChapters: (projectId: string) => Promise<void>
  createChapter: (title: string, parentId?: string | null, type?: 'volume' | 'chapter') => Promise<Chapter>
  selectChapter: (id: string) => void
  updateChapter: (id: string, updates: Partial<Chapter>) => Promise<void>
  updateChapterContent: (id: string, content: JSONContent) => Promise<void>
  deleteChapter: (id: string) => Promise<void>
  duplicateChapter: (id: string) => Promise<Chapter | null>
  undoDeleteChapter: () => Promise<boolean>
  reorderChapter: (id: string, newOrder: number) => Promise<void>
  moveChapter: (id: string, newParentId: string | null) => Promise<void>
  mergeChapters: (targetId: string, sourceIds: string[]) => Promise<void>
  moveChapterToPosition: (id: string, targetParentId: string | null, targetOrder: number) => Promise<void>
  insertChapterAt: (title: string, parentId: string | null, order: number, type?: 'volume' | 'chapter') => Promise<Chapter>
  toggleExpanded: (id: string) => void

  // Folder-based loading
  loadFromFolder: (data: StoryFlowFile, folderPath?: string, usesFolderStorage?: boolean) => Promise<void>

  // Computed
  getChapterTree: () => ChapterTreeItem[]
  getTotalWordCount: () => number
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  chapters: [],
  currentChapter: null,
  deletedChapterStack: [],
  undoToastVisible: false,

  loadProjects: async () => {
    const adapter = getAdapter()
    const projects = await adapter.fetchProjects()
    set({ projects })
  },

  createProject: async (title: string) => {
    const adapter = getAdapter()
    const project = createEntity<Project>({
      title,
      description: '',
      genre: '',
      synopsis: '',
      settings: {
        language: 'ko',
        targetDailyWords: 3000,
        readingSpeedCPM: 500,
      },
    })
    await adapter.insertProject(project)
    set(s => ({ projects: [project, ...s.projects], currentProject: project, chapters: [], currentChapter: null }))

    // Create default first chapter
    const chapter = createEntity<Chapter>({
      projectId: project.id,
      title: '제 1 화',
      order: 0,
      parentId: null,
      type: 'chapter',
      content: null,
      synopsis: '',
      wordCount: 0,
    })
    await adapter.insertChapter(chapter)
    set({ chapters: [chapter], currentChapter: chapter })

    // Reset world data for new project
    const { useWorldStore } = await import('./worldStore')
    await useWorldStore.getState().loadAll(project.id)

    // Load canvas data for new project and create default template
    const { useCanvasStore } = await import('./canvasStore')
    await useCanvasStore.getState().loadCanvas(project.id)
    await useCanvasStore.getState().createDefaultTemplate(project.id)

    return project
  },

  selectProject: async (id: string) => {
    const adapter = getAdapter()
    const project = await adapter.fetchProject(id)
    if (project) {
      set({ currentProject: project })
      // Clear undo/redo stacks when switching projects
      const { useUndoStore } = await import('./undoStore')
      useUndoStore.getState().clearAll()
      await get().loadChapters(id)
      // Load all world data
      const { useWorldStore } = await import('./worldStore')
      await useWorldStore.getState().loadAll(id)
      // Load canvas data
      const { useCanvasStore } = await import('./canvasStore')
      await useCanvasStore.getState().loadCanvas(id)
      // Load wiki data
      const { useWikiStore } = await import('./wikiStore')
      await useWikiStore.getState().loadEntries(id)
    }
  },

  updateProject: async (id: string, updates: Partial<Project>) => {
    const adapter = getAdapter()
    const merged = withUpdatedAt(updates)
    await adapter.updateProject(id, merged)
    set(s => ({
      projects: mapUpdate(s.projects, id, merged),
      currentProject: s.currentProject?.id === id ? { ...s.currentProject, ...merged } : s.currentProject,
    }))
  },

  deleteProject: async (id: string) => {
    const adapter = getAdapter()
    await adapter.deleteProject(id)
    await adapter.deleteChaptersByProject(id)
    await adapter.deleteCanvasNodesByProject(id)
    await adapter.deleteCanvasWiresByProject(id)
    await adapter.deleteWikiEntriesByProject(id)
    await adapter.deleteEmotionLogsByProject(id)
    await adapter.deleteStorySummariesByProject(id)
    set(s => ({
      projects: s.projects.filter(p => p.id !== id),
      currentProject: s.currentProject?.id === id ? null : s.currentProject,
      chapters: s.currentProject?.id === id ? [] : s.chapters,
      currentChapter: s.currentProject?.id === id ? null : s.currentChapter,
    }))
  },

  loadChapters: async (projectId: string) => {
    const adapter = getAdapter()
    const chapters = (await adapter.fetchChapters(projectId)).map(c =>
      c.type === 'volume' && !c.isExpanded ? { ...c, isExpanded: true } : c,
    )
    set({ chapters })
    if (chapters.length > 0 && !get().currentChapter) {
      set({ currentChapter: chapters[0] })
    }
  },

  createChapter: async (title: string, parentId: string | null = null, type: 'volume' | 'chapter' = 'chapter') => {
    const adapter = getAdapter()
    const { currentProject, chapters } = get()
    if (!currentProject) throw new Error('No project selected')

    const siblings = chapters.filter(c => c.parentId === parentId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(c => c.order)) : -1

    const chapter = createEntity<Chapter>({
      projectId: currentProject.id,
      title,
      order: maxOrder + 1,
      parentId,
      type,
      content: null,
      synopsis: '',
      wordCount: 0,
    })
    await adapter.insertChapter(chapter)
    set(s => ({ chapters: [...s.chapters, chapter] }))
    return chapter
  },

  selectChapter: (id: string) => {
    const chapter = get().chapters.find(c => c.id === id)
    if (chapter) {
      set({ currentChapter: chapter })
    }
  },

  updateChapter: async (id: string, updates: Partial<Chapter>) => {
    const adapter = getAdapter()
    const merged = withUpdatedAt(updates)
    await adapter.updateChapter(id, merged)
    set(s => ({
      chapters: mapUpdate(s.chapters, id, merged),
      currentChapter: s.currentChapter?.id === id ? { ...s.currentChapter, ...merged } : s.currentChapter,
    }))
  },

  updateChapterContent: async (id: string, content: JSONContent) => {
    const adapter = getAdapter()
    const ts = nowUTC()
    await adapter.updateChapter(id, { content, updatedAt: ts })
    set(s => ({
      chapters: s.chapters.map(c => c.id === id ? { ...c, content, updatedAt: ts } : c),
      currentChapter: s.currentChapter?.id === id ? { ...s.currentChapter, content, updatedAt: ts } : s.currentChapter,
    }))
  },

  duplicateChapter: async (id: string) => {
    const adapter = getAdapter()
    const { currentProject, chapters } = get()
    if (!currentProject) return null
    const source = chapters.find(c => c.id === id)
    if (!source) return null

    const siblings = chapters.filter(c => c.parentId === source.parentId)
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map(c => c.order)) : -1

    const copy = createEntity<Chapter>({
      projectId: currentProject.id,
      title: `${source.title} (복사본)`,
      order: maxOrder + 1,
      parentId: source.parentId,
      type: source.type,
      content: source.content,
      synopsis: source.synopsis,
      wordCount: source.wordCount,
    })
    await adapter.insertChapter(copy)
    set(s => ({ chapters: [...s.chapters, copy] }))
    return copy
  },

  mergeChapters: async (targetId: string, sourceIds: string[]) => {
    const adapter = getAdapter()
    const { chapters } = get()
    const target = chapters.find(c => c.id === targetId)
    if (!target) return

    // Sort sources by order so content is appended in document order
    const sources = sourceIds
      .map(id => chapters.find(c => c.id === id))
      .filter((c): c is Chapter => !!c)
      .sort((a, b) => a.order - b.order)
    if (sources.length === 0) return

    // Build merged content: target content + (hr + source content) for each source
    const targetContent = target.content?.content || []
    const merged: any[] = [...targetContent]
    for (const src of sources) {
      if (src.content?.content?.length) {
        merged.push({ type: 'horizontalRule' })
        merged.push(...src.content.content)
      }
    }
    const mergedDoc: JSONContent = { type: 'doc', content: merged }

    // Recalculate word count
    const { getTextFromContent } = await import('@/lib/utils')
    const plainText = getTextFromContent(mergedDoc)
    const wordCount = plainText.replace(/\s/g, '').length

    // Update target chapter
    const ts = nowUTC()
    await adapter.updateChapter(targetId, { content: mergedDoc, wordCount, updatedAt: ts })

    // Save sources to undo stack then delete them
    for (const src of sources) {
      const children = chapters.filter(c => c.parentId === src.id)
      set(s => ({
        deletedChapterStack: [
          { chapter: src, children, deletedAt: ts },
          ...s.deletedChapterStack,
        ].slice(0, 5),
      }))
      await adapter.deleteChapter(src.id)
      for (const child of children) {
        await adapter.deleteChapter(child.id)
      }
    }

    // Update state
    const deletedIds = new Set(sources.flatMap(s => [s.id, ...chapters.filter(c => c.parentId === s.id).map(c => c.id)]))
    set(s => ({
      chapters: s.chapters
        .filter(c => !deletedIds.has(c.id))
        .map(c => c.id === targetId ? { ...c, content: mergedDoc, wordCount, updatedAt: ts } : c),
      currentChapter: s.currentChapter?.id === targetId
        ? { ...s.currentChapter, content: mergedDoc, wordCount, updatedAt: ts }
        : s.currentChapter,
    }))
  },

  deleteChapter: async (id: string) => {
    const adapter = getAdapter()
    const { chapters } = get()

    // Save to undo stack before deleting
    const chapter = chapters.find(c => c.id === id)
    if (chapter) {
      const children = chapters.filter(c => c.parentId === id)
      set(s => ({
        deletedChapterStack: [
          { chapter, children, deletedAt: nowUTC() },
          ...s.deletedChapterStack,
        ].slice(0, 5),
      }))
    }

    await adapter.deleteChapter(id)
    await adapter.clearForeshadowChapterRefs(id)
    // Also delete children
    const children = chapters.filter(c => c.parentId === id)
    for (const child of children) {
      await adapter.deleteChapter(child.id)
      await adapter.clearForeshadowChapterRefs(child.id)
    }
    set(s => {
      const remaining = s.chapters.filter(c => c.id !== id && c.parentId !== id)
      return {
        chapters: remaining,
        currentChapter: s.currentChapter?.id === id ? (remaining[0] || null) : s.currentChapter,
      }
    })
    useEditorStore.getState().removeFoldedNodesByChapter(
      [id, ...children.map(c => c.id)],
    )
  },

  undoDeleteChapter: async () => {
    const { deletedChapterStack } = get()
    if (deletedChapterStack.length === 0) return false

    const adapter = getAdapter()
    const [entry, ...rest] = deletedChapterStack

    await adapter.insertChapter(entry.chapter)
    for (const child of entry.children) {
      await adapter.insertChapter(child)
    }

    set(s => ({
      deletedChapterStack: rest,
      chapters: [...s.chapters, entry.chapter, ...entry.children],
    }))

    return true
  },

  reorderChapter: async (id: string, newOrder: number) => {
    const adapter = getAdapter()
    await adapter.updateChapter(id, { order: newOrder, updatedAt: nowUTC() })
    set(s => ({
      chapters: s.chapters.map(c => c.id === id ? { ...c, order: newOrder } : c),
    }))
  },

  moveChapter: async (id: string, newParentId: string | null) => {
    const adapter = getAdapter()
    const { chapters } = get()
    const chapter = chapters.find(c => c.id === id)
    if (!chapter) return
    if (chapter.type === 'volume' && newParentId !== null) return
    if (id === newParentId) return

    const targetSiblings = chapters.filter(c => c.parentId === newParentId && c.id !== id)
    const newOrder = targetSiblings.length > 0 ? Math.max(...targetSiblings.map(c => c.order)) + 1 : 0

    const updates = { parentId: newParentId, order: newOrder, updatedAt: nowUTC() }
    await adapter.updateChapter(id, updates)
    set(s => ({
      chapters: mapUpdate(s.chapters, id, updates),
    }))
  },

  moveChapterToPosition: async (id: string, targetParentId: string | null, targetOrder: number) => {
    const adapter = getAdapter()
    const { chapters } = get()
    const chapter = chapters.find(c => c.id === id)
    if (!chapter) return
    if (chapter.type === 'volume' && targetParentId !== null) return
    if (id === targetParentId) return

    const ts = nowUTC()
    const siblings = chapters.filter(c => c.parentId === targetParentId && c.id !== id && c.order >= targetOrder)
    for (const sib of siblings) {
      await adapter.updateChapter(sib.id, { order: sib.order + 1, updatedAt: ts })
    }

    const updates = { parentId: targetParentId, order: targetOrder, updatedAt: ts }
    await adapter.updateChapter(id, updates)

    set(s => ({
      chapters: s.chapters.map(c => {
        if (c.id === id) return { ...c, ...updates }
        if (c.parentId === targetParentId && c.id !== id && c.order >= targetOrder) {
          return { ...c, order: c.order + 1 }
        }
        return c
      }),
    }))
  },

  insertChapterAt: async (title: string, parentId: string | null, order: number, type: 'volume' | 'chapter' = 'chapter') => {
    const adapter = getAdapter()
    const { currentProject, chapters } = get()
    if (!currentProject) throw new Error('No project selected')

    const ts = nowUTC()
    const siblings = chapters.filter(c => c.parentId === parentId && c.order >= order)
    for (const sib of siblings) {
      await adapter.updateChapter(sib.id, { order: sib.order + 1, updatedAt: ts })
    }

    const chapter: Chapter = {
      id: generateId(),
      projectId: currentProject.id,
      title,
      order,
      parentId,
      type,
      content: null,
      synopsis: '',
      wordCount: 0,
      createdAt: ts,
      updatedAt: ts,
    }
    await adapter.insertChapter(chapter)

    set(s => ({
      chapters: [
        ...s.chapters.map(c => {
          if (c.parentId === parentId && c.order >= order) return { ...c, order: c.order + 1 }
          return c
        }),
        chapter,
      ],
    }))
    return chapter
  },

  toggleExpanded: (id: string) => {
    set(s => ({
      chapters: s.chapters.map(c => c.id === id ? { ...c, isExpanded: !c.isExpanded } : c),
    }))
  },

  loadFromFolder: async (data: StoryFlowFile, folderPath?: string, usesFolderStorage?: boolean) => {
    const adapter = getAdapter()

    // Build project entity
    const project: Project = {
      id: data.project.id || generateId(),
      title: data.project.title,
      description: data.project.description || '',
      genre: data.project.genre || '',
      synopsis: data.project.synopsis || '',
      settings: data.project.settings || { language: 'ko', targetDailyWords: 3000, readingSpeedCPM: 500 },
      createdAt: data.project.createdAt || nowUTC(),
      updatedAt: data.project.updatedAt || nowUTC(),
      ...(folderPath ? { folderPath } : {}),
      ...(usesFolderStorage ? { usesFolderStorage: true } : {}),
    }

    // Check if project already exists — update or insert
    const existing = await adapter.fetchProject(project.id)
    if (existing) {
      await adapter.updateProject(project.id, project)
    } else {
      await adapter.insertProject(project)
    }

    // Insert chapters (clear existing first)
    await adapter.deleteChaptersByProject(project.id)
    for (const ch of data.chapters || []) {
      await adapter.insertChapter({ ...ch, projectId: project.id })
    }

    // Insert canvas nodes/wires (clear existing first)
    await adapter.deleteCanvasNodesByProject(project.id)
    await adapter.deleteCanvasWiresByProject(project.id)
    for (const node of data.canvas?.nodes || []) {
      await adapter.insertCanvasNode({ ...node, projectId: project.id })
    }
    for (const wire of data.canvas?.wires || []) {
      await adapter.insertCanvasWire({ ...wire, projectId: project.id })
    }

    // Insert wiki entries (clear existing first)
    await adapter.deleteWikiEntriesByProject(project.id)
    for (const entry of data.wikiEntries || []) {
      await adapter.insertWikiEntry({ ...entry, projectId: project.id })
    }

    // Insert world data
    // Characters
    const existingChars = await adapter.fetchCharacters(project.id)
    for (const c of existingChars) await adapter.deleteCharacter(c.id)
    for (const c of data.world?.characters || []) {
      await adapter.insertCharacter({ ...c, projectId: project.id })
    }

    // Relations
    const existingRels = await adapter.fetchRelations(project.id)
    for (const r of existingRels) await adapter.deleteRelation(r.id)
    for (const r of data.world?.relations || []) {
      await adapter.insertRelation({ ...r, projectId: project.id })
    }

    // World settings
    const existingWS = await adapter.fetchWorldSettings(project.id)
    for (const ws of existingWS) await adapter.deleteWorldSetting(ws.id)
    for (const ws of data.world?.worldSettings || []) {
      await adapter.insertWorldSetting({ ...ws, projectId: project.id })
    }

    // Items
    const existingItems = await adapter.fetchItems(project.id)
    for (const item of existingItems) await adapter.deleteItem(item.id)
    for (const item of data.world?.items || []) {
      await adapter.insertItem({ ...item, projectId: project.id })
    }

    // Foreshadows
    const existingFS = await adapter.fetchForeshadows(project.id)
    for (const f of existingFS) await adapter.deleteForeshadow(f.id)
    for (const f of data.world?.foreshadows || []) {
      await adapter.insertForeshadow({ ...f, projectId: project.id })
    }

    // Reference Data
    const existingRD = await adapter.fetchReferenceData(project.id)
    for (const rd of existingRD) await adapter.deleteReferenceData(rd.id)
    for (const rd of data.world?.referenceData || []) {
      await adapter.insertReferenceData({ ...rd, projectId: project.id })
    }

    // Reload projects list and select this project
    await get().loadProjects()
    await get().selectProject(project.id)
  },

  getChapterTree: () => {
    const { chapters } = get()
    const buildTree = (parentId: string | null): ChapterTreeItem[] => {
      return chapters
        .filter(c => c.parentId === parentId)
        .sort((a, b) => a.order - b.order)
        .map(c => ({ ...c, children: buildTree(c.id) }))
    }
    return buildTree(null)
  },

  getTotalWordCount: () => {
    return get().chapters.reduce((sum, c) => sum + c.wordCount, 0)
  },
}))
