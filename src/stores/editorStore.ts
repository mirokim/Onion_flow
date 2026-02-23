import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { generateId } from '@/lib/utils'

export type Theme = 'light' | 'dark' | 'black'
export type Language = 'ko' | 'en'
export type UISizeScale = 'xs' | 's' | 'm' | 'l' | 'xl'
export type PanelTab = 'canvas' | 'editor' | 'wiki' | 'chapters' | 'openfiles' | 'ai'

// Inner tab types for multi-tab panels
export interface EditorInnerTab {
  id: string
  type: 'chapter'
  targetId: string   // chapterId
  label: string
  isPinned: boolean
}

export interface CanvasInnerTab {
  id: string
  type: 'canvas'
  targetId: string | null  // parentCanvasId (null = root)
  label: string
  isPinned: boolean
}

// File tree node for the virtual file explorer
export interface FileTreeNode {
  id: string
  type: 'folder' | 'canvas' | 'chapter'
  name: string
  targetId?: string          // for canvas/chapter: references the actual tab/chapter ID
  children: string[]         // for folders: ordered child node IDs
  parentId: string | null    // null = root level
  order: number
  isExpanded: boolean
  createdAt: number
}

interface EditorState {
  // Layout
  theme: Theme
  language: Language
  uiScale: UISizeScale
  focusMode: boolean
  showOpenFilesPanel: boolean
  openTabs: PanelTab[]
  canvasWidth: number
  wikiWidth: number
  openFilesWidth: number
  pinnedPanels: PanelTab[]

  // Editor options
  showLineNumbers: boolean
  lineNumberOpacity: number

  // Inner tabs (multi-tab)
  editorTabs: EditorInnerTab[]
  activeEditorTabId: string | null
  canvasTabs: CanvasInnerTab[]
  activeCanvasTabId: string | null

  // Emotion data (AI-generated, per character per chapter)
  emotionData: Record<string, Record<string, Record<string, number>>>

  // Folding state (persisted per chapter)
  foldedNodesByChapter: Record<string, string[]>

  // File tree (virtual file explorer)
  fileTreeNodes: Record<string, FileTreeNode>
  fileTreeRoots: string[]
  fileTreeSortBy: 'name' | 'date'

  // Actions
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
  setUiScale: (scale: UISizeScale) => void
  setFocusMode: (v: boolean) => void
  toggleFocusMode: () => void
  toggleOpenFilesPanel: () => void
  toggleTab: (tab: PanelTab) => void
  reorderTabs: (newOrder: PanelTab[]) => void
  setCanvasWidth: (w: number) => void
  setWikiWidth: (w: number) => void
  setOpenFilesWidth: (w: number) => void
  setShowLineNumbers: (v: boolean) => void
  setLineNumberOpacity: (v: number) => void
  setEmotionData: (characterId: string, chapterId: string, emotions: Record<string, number>) => void
  setFoldedNodesByChapter: (chapterId: string, ids: string[]) => void
  removeFoldedNodesByChapter: (chapterIds: string[]) => void

  // Inner tab actions
  openEditorTab: (chapterId: string, label: string) => void
  closeEditorTab: (tabId: string) => void
  setActiveEditorTab: (tabId: string) => void
  reorderEditorTabs: (fromId: string, toId: string) => void
  toggleEditorTabPin: (tabId: string) => void
  openCanvasTab: (targetId: string | null, label: string) => void
  closeCanvasTab: (tabId: string) => void
  setActiveCanvasTab: (tabId: string) => void
  reorderCanvasTabs: (fromId: string, toId: string) => void
  toggleCanvasTabPin: (tabId: string) => void
  togglePanelPin: (tab: PanelTab) => void

  // File tree actions
  addFileTreeNode: (node: Omit<FileTreeNode, 'id' | 'createdAt' | 'order'> & { order?: number }) => string
  removeFileTreeNode: (nodeId: string) => void
  moveFileTreeNode: (nodeId: string, newParentId: string | null, insertBeforeId?: string | null) => void
  renameFileTreeNode: (nodeId: string, name: string) => void
  toggleFileTreeNodeExpanded: (nodeId: string) => void
  expandAllFolders: () => void
  collapseAllFolders: () => void
  setFileTreeSortBy: (sortBy: 'name' | 'date') => void
  syncFileTreeWithTabs: () => void
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      language: 'ko',
      uiScale: 'm',
      focusMode: false,
      showOpenFilesPanel: true,
      openTabs: ['canvas', 'editor'] as PanelTab[],
      canvasWidth: 480,
      wikiWidth: 300,
      openFilesWidth: 180,
      pinnedPanels: [] as PanelTab[],
      showLineNumbers: false,
      lineNumberOpacity: 0.4,
      editorTabs: [],
      activeEditorTabId: null,
      canvasTabs: [{ id: 'canvas-root', type: 'canvas', targetId: null, label: 'Root Canvas', isPinned: false }],
      activeCanvasTabId: 'canvas-root',
      emotionData: {},
      foldedNodesByChapter: {},
      fileTreeNodes: {},
      fileTreeRoots: [],
      fileTreeSortBy: 'name' as const,

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setUiScale: (uiScale) => set({ uiScale }),
      setFocusMode: (focusMode) => set({ focusMode }),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      toggleOpenFilesPanel: () => set((s) => ({ showOpenFilesPanel: !s.showOpenFilesPanel })),
      toggleTab: (tab) => set((s) => {
        const isOpen = s.openTabs.includes(tab)
        if (isOpen) {
          if (s.openTabs.length <= 1) return s
          return { openTabs: s.openTabs.filter(t => t !== tab) }
        } else {
          // Maximum 5 layout panels can be open simultaneously
          const MAX_PANELS = 5
          if (s.openTabs.length >= MAX_PANELS) return s
          return { openTabs: [...s.openTabs, tab] }
        }
      }),
      reorderTabs: (newOrder) => set({ openTabs: newOrder }),
      setCanvasWidth: (canvasWidth) => set({ canvasWidth }),
      setWikiWidth: (wikiWidth) => set({ wikiWidth }),
      setOpenFilesWidth: (openFilesWidth) => set({ openFilesWidth }),
      setShowLineNumbers: (showLineNumbers) => set({ showLineNumbers }),
      setLineNumberOpacity: (lineNumberOpacity) => set({ lineNumberOpacity }),
      setEmotionData: (characterId, chapterId, emotions) =>
        set((s) => ({
          emotionData: {
            ...s.emotionData,
            [characterId]: { ...(s.emotionData[characterId] || {}), [chapterId]: emotions },
          },
        })),
      setFoldedNodesByChapter: (chapterId, ids) =>
        set((s) => ({ foldedNodesByChapter: { ...s.foldedNodesByChapter, [chapterId]: ids } })),
      removeFoldedNodesByChapter: (chapterIds) =>
        set((s) => {
          const updated = { ...s.foldedNodesByChapter }
          for (const id of chapterIds) delete updated[id]
          return { foldedNodesByChapter: updated }
        }),

      // ── Inner Tab Actions ──
      openEditorTab: (chapterId, label) => set((s) => {
        // Focus existing tab if already open
        const existing = s.editorTabs.find(t => t.targetId === chapterId)
        if (existing) {
          return { activeEditorTabId: existing.id }
        }
        // Create new tab
        const tab: EditorInnerTab = { id: generateId(), type: 'chapter', targetId: chapterId, label, isPinned: false }
        return {
          editorTabs: [...s.editorTabs, tab],
          activeEditorTabId: tab.id,
        }
      }),

      closeEditorTab: (tabId) => set((s) => {
        const target = s.editorTabs.find(t => t.id === tabId)
        if (target?.isPinned) return s // pinned tabs cannot be closed
        const tabs = s.editorTabs.filter(t => t.id !== tabId)
        let activeId = s.activeEditorTabId
        if (activeId === tabId) {
          const idx = s.editorTabs.findIndex(t => t.id === tabId)
          activeId = tabs[Math.min(idx, tabs.length - 1)]?.id || null
        }
        return { editorTabs: tabs, activeEditorTabId: activeId }
      }),

      setActiveEditorTab: (tabId) => set({ activeEditorTabId: tabId }),

      openCanvasTab: (targetId, label) => set((s) => {
        const existing = s.canvasTabs.find(t => t.targetId === targetId)
        if (existing) {
          return { activeCanvasTabId: existing.id }
        }
        const tab: CanvasInnerTab = { id: generateId(), type: 'canvas', targetId, label, isPinned: false }
        return {
          canvasTabs: [...s.canvasTabs, tab],
          activeCanvasTabId: tab.id,
        }
      }),

      closeCanvasTab: (tabId) => set((s) => {
        const target = s.canvasTabs.find(t => t.id === tabId)
        if (target?.isPinned) return s // pinned tabs cannot be closed
        if (s.canvasTabs.length <= 1) return s
        const tabs = s.canvasTabs.filter(t => t.id !== tabId)
        let activeId = s.activeCanvasTabId
        if (activeId === tabId) {
          const idx = s.canvasTabs.findIndex(t => t.id === tabId)
          activeId = tabs[Math.min(idx, tabs.length - 1)]?.id || null
        }
        return { canvasTabs: tabs, activeCanvasTabId: activeId }
      }),

      setActiveCanvasTab: (tabId) => set({ activeCanvasTabId: tabId }),

      // ── Tab Reorder Actions ──
      reorderEditorTabs: (fromId, toId) => set((s) => {
        const tabs = [...s.editorTabs]
        const fromIdx = tabs.findIndex(t => t.id === fromId)
        const toIdx = tabs.findIndex(t => t.id === toId)
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return s
        const [moved] = tabs.splice(fromIdx, 1)
        tabs.splice(toIdx, 0, moved)
        return { editorTabs: tabs }
      }),

      toggleEditorTabPin: (tabId) => set((s) => {
        const tabs = s.editorTabs.map(t =>
          t.id === tabId ? { ...t, isPinned: !t.isPinned } : t
        )
        // Sort: pinned tabs first, unpinned after
        const pinned = tabs.filter(t => t.isPinned)
        const unpinned = tabs.filter(t => !t.isPinned)
        return { editorTabs: [...pinned, ...unpinned] }
      }),

      reorderCanvasTabs: (fromId, toId) => set((s) => {
        const tabs = [...s.canvasTabs]
        const fromIdx = tabs.findIndex(t => t.id === fromId)
        const toIdx = tabs.findIndex(t => t.id === toId)
        if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return s
        const [moved] = tabs.splice(fromIdx, 1)
        tabs.splice(toIdx, 0, moved)
        return { canvasTabs: tabs }
      }),

      toggleCanvasTabPin: (tabId) => set((s) => {
        const tabs = s.canvasTabs.map(t =>
          t.id === tabId ? { ...t, isPinned: !t.isPinned } : t
        )
        const pinned = tabs.filter(t => t.isPinned)
        const unpinned = tabs.filter(t => !t.isPinned)
        return { canvasTabs: [...pinned, ...unpinned] }
      }),

      togglePanelPin: (tab) => set((s) => {
        const isPinned = s.pinnedPanels.includes(tab)
        return {
          pinnedPanels: isPinned
            ? s.pinnedPanels.filter(t => t !== tab)
            : [...s.pinnedPanels, tab],
        }
      }),

      // ── File Tree Actions ──
      addFileTreeNode: (input) => {
        const id = generateId()
        const siblings = input.parentId
          ? (get().fileTreeNodes[input.parentId]?.children ?? [])
          : get().fileTreeRoots
        const order = input.order ?? siblings.length
        const node: FileTreeNode = {
          ...input,
          id,
          order,
          children: input.children ?? [],
          isExpanded: input.isExpanded ?? (input.type === 'folder'),
          createdAt: Date.now(),
        }

        set((s) => {
          const nodes = { ...s.fileTreeNodes, [id]: node }
          let roots = [...s.fileTreeRoots]

          if (node.parentId) {
            const parent = nodes[node.parentId]
            if (parent) {
              nodes[node.parentId] = { ...parent, children: [...parent.children, id] }
            }
          } else {
            roots = [...roots, id]
          }

          return { fileTreeNodes: nodes, fileTreeRoots: roots }
        })
        return id
      },

      removeFileTreeNode: (nodeId) => set((s) => {
        const nodes = { ...s.fileTreeNodes }
        let roots = [...s.fileTreeRoots]

        const toRemove = new Set<string>()
        const collect = (id: string) => {
          toRemove.add(id)
          const n = nodes[id]
          if (n?.children) n.children.forEach(collect)
        }
        collect(nodeId)

        const node = nodes[nodeId]
        if (node?.parentId && nodes[node.parentId]) {
          const parent = { ...nodes[node.parentId] }
          parent.children = parent.children.filter(cid => !toRemove.has(cid))
          nodes[node.parentId] = parent
        } else {
          roots = roots.filter(rid => !toRemove.has(rid))
        }

        for (const id of toRemove) delete nodes[id]

        return { fileTreeNodes: nodes, fileTreeRoots: roots }
      }),

      moveFileTreeNode: (nodeId, newParentId, insertBeforeId) => set((s) => {
        const nodes = { ...s.fileTreeNodes }
        const oldNode = nodes[nodeId]
        if (!oldNode) return s

        // Prevent moving into own descendants
        const isDescendant = (ancestorId: string, checkId: string | null): boolean => {
          if (!checkId) return false
          if (checkId === ancestorId) return true
          const n = nodes[checkId]
          return n?.parentId ? isDescendant(ancestorId, n.parentId) : false
        }
        if (newParentId && isDescendant(nodeId, newParentId)) return s

        let roots = [...s.fileTreeRoots]

        // Remove from old parent
        if (oldNode.parentId && nodes[oldNode.parentId]) {
          const oldParent = { ...nodes[oldNode.parentId] }
          oldParent.children = oldParent.children.filter(id => id !== nodeId)
          nodes[oldNode.parentId] = oldParent
        } else {
          roots = roots.filter(id => id !== nodeId)
        }

        // Insert into new parent
        if (newParentId && nodes[newParentId]) {
          const newParent = { ...nodes[newParentId] }
          const idx = insertBeforeId ? newParent.children.indexOf(insertBeforeId) : -1
          if (idx >= 0) {
            newParent.children = [...newParent.children]
            newParent.children.splice(idx, 0, nodeId)
          } else {
            newParent.children = [...newParent.children, nodeId]
          }
          nodes[newParentId] = newParent
        } else {
          const idx = insertBeforeId ? roots.indexOf(insertBeforeId) : -1
          if (idx >= 0) {
            roots.splice(idx, 0, nodeId)
          } else {
            roots.push(nodeId)
          }
        }

        nodes[nodeId] = { ...oldNode, parentId: newParentId }

        return { fileTreeNodes: nodes, fileTreeRoots: roots }
      }),

      renameFileTreeNode: (nodeId, name) => set((s) => ({
        fileTreeNodes: {
          ...s.fileTreeNodes,
          [nodeId]: { ...s.fileTreeNodes[nodeId], name },
        },
      })),

      toggleFileTreeNodeExpanded: (nodeId) => set((s) => {
        const node = s.fileTreeNodes[nodeId]
        if (!node || node.type !== 'folder') return s
        return {
          fileTreeNodes: {
            ...s.fileTreeNodes,
            [nodeId]: { ...node, isExpanded: !node.isExpanded },
          },
        }
      }),

      expandAllFolders: () => set((s) => {
        const nodes = { ...s.fileTreeNodes }
        for (const id of Object.keys(nodes)) {
          if (nodes[id].type === 'folder') {
            nodes[id] = { ...nodes[id], isExpanded: true }
          }
        }
        return { fileTreeNodes: nodes }
      }),

      collapseAllFolders: () => set((s) => {
        const nodes = { ...s.fileTreeNodes }
        for (const id of Object.keys(nodes)) {
          if (nodes[id].type === 'folder') {
            nodes[id] = { ...nodes[id], isExpanded: false }
          }
        }
        return { fileTreeNodes: nodes }
      }),

      setFileTreeSortBy: (sortBy) => set({ fileTreeSortBy: sortBy }),

      syncFileTreeWithTabs: () => {
        const s = get()
        const existingCanvasTargets = new Set(
          Object.values(s.fileTreeNodes)
            .filter(n => n.type === 'canvas')
            .map(n => n.targetId)
        )
        const existingChapterTargets = new Set(
          Object.values(s.fileTreeNodes)
            .filter(n => n.type === 'chapter')
            .map(n => n.targetId)
        )

        for (const tab of s.canvasTabs) {
          if (!existingCanvasTargets.has(tab.id)) {
            s.addFileTreeNode({
              type: 'canvas',
              name: tab.label,
              targetId: tab.id,
              parentId: null,
              children: [],
              isExpanded: false,
            })
          }
        }

        for (const tab of s.editorTabs) {
          if (!existingChapterTargets.has(tab.targetId)) {
            s.addFileTreeNode({
              type: 'chapter',
              name: tab.label,
              targetId: tab.targetId,
              parentId: null,
              children: [],
              isExpanded: false,
            })
          }
        }
      },
    }),
    {
      name: 'onion-flow-editor',
      version: 10,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        uiScale: state.uiScale,
        showOpenFilesPanel: state.showOpenFilesPanel,
        openTabs: state.openTabs,
        canvasWidth: state.canvasWidth,
        wikiWidth: state.wikiWidth,
        openFilesWidth: state.openFilesWidth,
        pinnedPanels: state.pinnedPanels,
        foldedNodesByChapter: state.foldedNodesByChapter,
        fileTreeNodes: state.fileTreeNodes,
        fileTreeRoots: state.fileTreeRoots,
        fileTreeSortBy: state.fileTreeSortBy,
      }),
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          const tabs: PanelTab[] = ['editor']
          if (persisted.canvasPanelOpen !== false) tabs.unshift('canvas')
          if (persisted.wikiPanelOpen !== false) tabs.push('wiki')
          persisted.openTabs = tabs
          delete persisted.canvasPanelOpen
          delete persisted.wikiPanelOpen
        }
        if (version < 3) {
          // v3: PanelTab now includes 'chapters' — no automatic changes needed
        }
        // v4: wiki and chapters are mutually exclusive, default to canvas+editor only
        if (version < 4) {
          const tabs: PanelTab[] = persisted.openTabs ?? ['canvas', 'editor']
          // Remove both wiki and chapters — user opens them on demand via sidebar
          persisted.openTabs = tabs.filter((t: PanelTab) => t !== 'wiki' && t !== 'chapters')
          // Ensure at least canvas+editor
          if (!persisted.openTabs.includes('canvas')) persisted.openTabs.unshift('canvas')
          if (!persisted.openTabs.includes('editor')) persisted.openTabs.push('editor')
        }
        // v5: force canvas+editor default (cleanup stale localStorage)
        if (version < 5) {
          persisted.openTabs = ['canvas', 'editor']
        }
        // v6: openfiles is now a fixed panel, remove from openTabs
        if (version < 6) {
          const tabs: PanelTab[] = persisted.openTabs ?? ['canvas', 'editor']
          persisted.openTabs = tabs.filter((t: PanelTab) => t !== 'openfiles')
          if (persisted.openTabs.length === 0) {
            persisted.openTabs = ['canvas', 'editor']
          }
        }
        // v7: add file tree state
        if (version < 7) {
          persisted.fileTreeNodes = persisted.fileTreeNodes ?? {}
          persisted.fileTreeRoots = persisted.fileTreeRoots ?? []
          persisted.fileTreeSortBy = persisted.fileTreeSortBy ?? 'name'
        }
        // v8: add showOpenFilesPanel, 'ai' PanelTab
        if (version < 8) {
          persisted.showOpenFilesPanel = persisted.showOpenFilesPanel ?? true
        }
        // v9: add openFilesWidth, isPinned on inner tabs, remove mutual exclusivity
        if (version < 9) {
          persisted.openFilesWidth = persisted.openFilesWidth ?? 180
        }
        // v10: add pinnedPanels for panel-level pin
        if (version < 10) {
          persisted.pinnedPanels = persisted.pinnedPanels ?? []
        }
        return persisted as EditorState
      },
    },
  ),
)
