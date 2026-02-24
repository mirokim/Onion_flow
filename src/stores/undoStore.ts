/**
 * Centralized undo/redo store using command pattern.
 * Maintains per-context stacks (canvas, wiki) with closure-based undo/redo.
 */
import { create } from 'zustand'

export type UndoContext = 'canvas' | 'wiki'

export interface UndoEntry {
  label: string
  context: UndoContext
  /** If set, replaces the top entry with the same key instead of pushing a new one. */
  coalescingKey?: string
  undo: () => Promise<void>
  redo: () => Promise<void>
}

interface UndoState {
  undoStacks: Record<UndoContext, UndoEntry[]>
  redoStacks: Record<UndoContext, UndoEntry[]>

  /**
   * When true, pushUndo() is silently ignored.
   * Prevents recursive undo entries when undo/redo closures call store mutations.
   */
  _isUndoRedoInProgress: boolean

  pushUndo: (entry: UndoEntry) => void
  undo: (ctx: UndoContext) => Promise<void>
  redo: (ctx: UndoContext) => Promise<void>
  canUndo: (ctx: UndoContext) => boolean
  canRedo: (ctx: UndoContext) => boolean
  clearAll: () => void
}

const MAX_UNDO = 50

const emptyStacks = (): Record<UndoContext, UndoEntry[]> => ({ canvas: [], wiki: [] })

export const useUndoStore = create<UndoState>((set, get) => ({
  undoStacks: emptyStacks(),
  redoStacks: emptyStacks(),
  _isUndoRedoInProgress: false,

  pushUndo: (entry) => {
    if (get()._isUndoRedoInProgress) return
    set(s => {
      const stack = s.undoStacks[entry.context]
      let newStack: UndoEntry[]

      // Coalesce: if top entry shares the same coalescingKey, replace it
      if (
        entry.coalescingKey &&
        stack.length > 0 &&
        stack[stack.length - 1].coalescingKey === entry.coalescingKey
      ) {
        newStack = [...stack.slice(0, -1), entry]
      } else {
        newStack = [...stack.slice(-(MAX_UNDO - 1)), entry]
      }

      return {
        undoStacks: { ...s.undoStacks, [entry.context]: newStack },
        redoStacks: { ...s.redoStacks, [entry.context]: [] }, // Clear redo on new action
      }
    })
  },

  undo: async (ctx) => {
    const stack = get().undoStacks[ctx]
    if (stack.length === 0) return

    const entry = stack[stack.length - 1]

    set(s => ({
      _isUndoRedoInProgress: true,
      undoStacks: { ...s.undoStacks, [ctx]: s.undoStacks[ctx].slice(0, -1) },
    }))

    try {
      await entry.undo()
    } finally {
      set(s => ({
        _isUndoRedoInProgress: false,
        redoStacks: { ...s.redoStacks, [ctx]: [...s.redoStacks[ctx], entry] },
      }))
    }
  },

  redo: async (ctx) => {
    const stack = get().redoStacks[ctx]
    if (stack.length === 0) return

    const entry = stack[stack.length - 1]

    set(s => ({
      _isUndoRedoInProgress: true,
      redoStacks: { ...s.redoStacks, [ctx]: s.redoStacks[ctx].slice(0, -1) },
    }))

    try {
      await entry.redo()
    } finally {
      set(s => ({
        _isUndoRedoInProgress: false,
        undoStacks: { ...s.undoStacks, [ctx]: [...s.undoStacks[ctx], entry] },
      }))
    }
  },

  canUndo: (ctx) => get().undoStacks[ctx].length > 0,
  canRedo: (ctx) => get().redoStacks[ctx].length > 0,

  clearAll: () => set({
    undoStacks: emptyStacks(),
    redoStacks: emptyStacks(),
    _isUndoRedoInProgress: false,
  }),
}))
