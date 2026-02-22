import { create } from 'zustand'
import { getAdapter } from '@/db/storageAdapter'
import type { Project, Chapter, ChapterTreeItem } from '@/types'
import { generateId } from '@/lib/utils'
import type { JSONContent } from '@tiptap/react'
import { useEditorStore } from './editorStore'

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
  undoDeleteChapter: () => Promise<boolean>
  reorderChapter: (id: string, newOrder: number) => Promise<void>
  moveChapter: (id: string, newParentId: string | null) => Promise<void>
  moveChapterToPosition: (id: string, targetParentId: string | null, targetOrder: number) => Promise<void>
  insertChapterAt: (title: string, parentId: string | null, order: number, type?: 'volume' | 'chapter') => Promise<Chapter>
  toggleExpanded: (id: string) => void

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
    const project: Project = {
      id: generateId(),
      title,
      description: '',
      genre: '',
      synopsis: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      settings: {
        language: 'ko',
        targetDailyWords: 3000,
        readingSpeedCPM: 500,
      },
    }
    await adapter.insertProject(project)
    set(s => ({ projects: [project, ...s.projects], currentProject: project, chapters: [], currentChapter: null }))

    // Create default first chapter
    const chapter: Chapter = {
      id: generateId(),
      projectId: project.id,
      title: '제 1 화',
      order: 0,
      parentId: null,
      type: 'chapter',
      content: null,
      synopsis: '',
      wordCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
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
    const merged = { ...updates, updatedAt: Date.now() }
    await adapter.updateProject(id, merged)
    set(s => ({
      projects: s.projects.map(p => p.id === id ? { ...p, ...merged } : p),
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

    const chapter: Chapter = {
      id: generateId(),
      projectId: currentProject.id,
      title,
      order: maxOrder + 1,
      parentId,
      type,
      content: null,
      synopsis: '',
      wordCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
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
    const merged = { ...updates, updatedAt: Date.now() }
    await adapter.updateChapter(id, merged)
    set(s => ({
      chapters: s.chapters.map(c => c.id === id ? { ...c, ...merged } : c),
      currentChapter: s.currentChapter?.id === id ? { ...s.currentChapter, ...merged } : s.currentChapter,
    }))
  },

  updateChapterContent: async (id: string, content: JSONContent) => {
    const adapter = getAdapter()
    await adapter.updateChapter(id, { content, updatedAt: Date.now() })
    set(s => ({
      chapters: s.chapters.map(c => c.id === id ? { ...c, content, updatedAt: Date.now() } : c),
      currentChapter: s.currentChapter?.id === id ? { ...s.currentChapter, content, updatedAt: Date.now() } : s.currentChapter,
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
          { chapter, children, deletedAt: Date.now() },
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
    await adapter.updateChapter(id, { order: newOrder, updatedAt: Date.now() })
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

    const updates = { parentId: newParentId, order: newOrder, updatedAt: Date.now() }
    await adapter.updateChapter(id, updates)
    set(s => ({
      chapters: s.chapters.map(c => c.id === id ? { ...c, ...updates } : c),
    }))
  },

  moveChapterToPosition: async (id: string, targetParentId: string | null, targetOrder: number) => {
    const adapter = getAdapter()
    const { chapters } = get()
    const chapter = chapters.find(c => c.id === id)
    if (!chapter) return
    if (chapter.type === 'volume' && targetParentId !== null) return
    if (id === targetParentId) return

    const siblings = chapters.filter(c => c.parentId === targetParentId && c.id !== id && c.order >= targetOrder)
    for (const sib of siblings) {
      await adapter.updateChapter(sib.id, { order: sib.order + 1, updatedAt: Date.now() })
    }

    const updates = { parentId: targetParentId, order: targetOrder, updatedAt: Date.now() }
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

    const siblings = chapters.filter(c => c.parentId === parentId && c.order >= order)
    for (const sib of siblings) {
      await adapter.updateChapter(sib.id, { order: sib.order + 1, updatedAt: Date.now() })
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
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
