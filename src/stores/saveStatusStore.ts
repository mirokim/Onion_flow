import { create } from 'zustand'

export type SaveState = 'idle' | 'modified' | 'saving' | 'saved'

interface SaveStatusState {
  status: SaveState
  lastSavedAt: number | null
  setModified: () => void
  setSaving: () => void
  setSaved: () => void
  setIdle: () => void
}

let savedTimer: ReturnType<typeof setTimeout> | null = null

export const useSaveStatusStore = create<SaveStatusState>((set) => ({
  status: 'idle',
  lastSavedAt: null,

  setModified: () => set({ status: 'modified' }),

  setSaving: () => set({ status: 'saving' }),

  setSaved: () => {
    if (savedTimer) clearTimeout(savedTimer)
    set({ status: 'saved', lastSavedAt: Date.now() })
    savedTimer = setTimeout(() => {
      set({ status: 'idle' })
    }, 3000)
  },

  setIdle: () => set({ status: 'idle' }),
}))
