import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export type Theme = 'light' | 'dark' | 'black'
export type Language = 'ko' | 'en'
export type UISizeScale = 'xs' | 's' | 'm' | 'l' | 'xl'
export type PanelTab = 'canvas' | 'editor' | 'wiki'

interface EditorState {
  // Layout
  theme: Theme
  language: Language
  uiScale: UISizeScale
  focusMode: boolean
  openTabs: PanelTab[]
  canvasWidth: number
  wikiWidth: number

  // Editor options
  showLineNumbers: boolean
  lineNumberOpacity: number

  // Emotion data (AI-generated, per character per chapter)
  emotionData: Record<string, Record<string, Record<string, number>>>

  // Folding state (persisted per chapter)
  foldedNodesByChapter: Record<string, string[]>

  // Actions
  setTheme: (theme: Theme) => void
  setLanguage: (language: Language) => void
  setUiScale: (scale: UISizeScale) => void
  setFocusMode: (v: boolean) => void
  toggleFocusMode: () => void
  toggleTab: (tab: PanelTab) => void
  reorderTabs: (newOrder: PanelTab[]) => void
  setCanvasWidth: (w: number) => void
  setWikiWidth: (w: number) => void
  setShowLineNumbers: (v: boolean) => void
  setLineNumberOpacity: (v: number) => void
  setEmotionData: (characterId: string, chapterId: string, emotions: Record<string, number>) => void
  setFoldedNodesByChapter: (chapterId: string, ids: string[]) => void
  removeFoldedNodesByChapter: (chapterIds: string[]) => void
}

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      theme: 'dark',
      language: 'ko',
      uiScale: 'm',
      focusMode: false,
      openTabs: ['canvas', 'editor', 'wiki'] as PanelTab[],
      canvasWidth: 480,
      wikiWidth: 300,
      showLineNumbers: false,
      lineNumberOpacity: 0.4,
      emotionData: {},
      foldedNodesByChapter: {},

      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setUiScale: (uiScale) => set({ uiScale }),
      setFocusMode: (focusMode) => set({ focusMode }),
      toggleFocusMode: () => set((s) => ({ focusMode: !s.focusMode })),
      toggleTab: (tab) => set((s) => {
        const isOpen = s.openTabs.includes(tab)
        if (isOpen) {
          // Don't close if it's the last open tab
          if (s.openTabs.length <= 1) return s
          return { openTabs: s.openTabs.filter(t => t !== tab) }
        } else {
          // Append to end (user can drag to reorder)
          return { openTabs: [...s.openTabs, tab] }
        }
      }),
      reorderTabs: (newOrder) => set({ openTabs: newOrder }),
      setCanvasWidth: (canvasWidth) => set({ canvasWidth }),
      setWikiWidth: (wikiWidth) => set({ wikiWidth }),
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
    }),
    {
      name: 'onion-flow-editor',
      version: 2,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        theme: state.theme,
        language: state.language,
        uiScale: state.uiScale,
        openTabs: state.openTabs,
        canvasWidth: state.canvasWidth,
        wikiWidth: state.wikiWidth,
        foldedNodesByChapter: state.foldedNodesByChapter,
      }),
      migrate: (persisted: any, version: number) => {
        if (version < 2) {
          // Migrate from v1 boolean panel flags to v2 openTabs array
          const tabs: PanelTab[] = ['editor']
          if (persisted.canvasPanelOpen !== false) tabs.unshift('canvas')
          if (persisted.wikiPanelOpen !== false) tabs.push('wiki')
          persisted.openTabs = tabs
          delete persisted.canvasPanelOpen
          delete persisted.wikiPanelOpen
        }
        return persisted as EditorState
      },
    },
  ),
)
