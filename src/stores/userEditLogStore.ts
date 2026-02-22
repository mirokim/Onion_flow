import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type EditableEntityType = 'emotion' | 'character' | 'relation' | 'world_setting' | 'item' | 'foreshadow'

export interface UserEditLogEntry {
  id: string
  entityType: EditableEntityType
  entityId: string
  entityName: string
  field: string
  oldValue: any
  newValue: any
  timestamp: number
}

export interface PendingAIConfirmation {
  id: string
  toolName: string
  params: Record<string, any>
  entityType: EditableEntityType
  entityId: string
  entityName: string
  userEditLogs: UserEditLogEntry[]
  resolve: (confirmed: boolean, excludeFields?: string[]) => void
}

export interface PendingDeleteItem {
  toolCallId: string
  toolName: string
  params: Record<string, any>
  targetName: string
  entityType: string
  checked: boolean
}

export interface PendingAIDeleteConfirmation {
  id: string
  items: PendingDeleteItem[]
  resolve: (approvedItems: PendingDeleteItem[]) => void
}

interface UserEditLogState {
  logs: UserEditLogEntry[]
  pendingConfirmation: PendingAIConfirmation | null
  pendingDeleteConfirmation: PendingAIDeleteConfirmation | null

  addLog: (entry: Omit<UserEditLogEntry, 'id' | 'timestamp'>) => void
  getLogsForEntity: (entityType: EditableEntityType, entityId: string) => UserEditLogEntry[]
  clearLogsForEntity: (entityType: EditableEntityType, entityId: string) => void
  clearAllLogs: () => void

  setPendingConfirmation: (pending: PendingAIConfirmation | null) => void
  resolvePendingConfirmation: (confirmed: boolean, excludeFields?: string[]) => void

  setPendingDeleteConfirmation: (pending: PendingAIDeleteConfirmation | null) => void
  toggleDeleteItem: (toolCallId: string) => void
  toggleAllDeleteItems: (checked: boolean) => void
  resolvePendingDeleteConfirmation: (confirmed: boolean) => void
}

let idCounter = 0

export const useUserEditLogStore = create<UserEditLogState>()(
  persist(
    (set, get) => ({
      logs: [],
      pendingConfirmation: null,
      pendingDeleteConfirmation: null,

      addLog: (entry) => {
        set(s => {
          const existingIdx = s.logs.findIndex(
            l => l.entityType === entry.entityType && l.entityId === entry.entityId && l.field === entry.field
          )
          if (existingIdx >= 0) {
            const updated = [...s.logs]
            updated[existingIdx] = {
              ...updated[existingIdx],
              newValue: entry.newValue,
              timestamp: Date.now(),
            }
            return { logs: updated }
          }
          const log: UserEditLogEntry = {
            ...entry,
            id: `uel_${Date.now()}_${++idCounter}`,
            timestamp: Date.now(),
          }
          return { logs: [...s.logs, log] }
        })
      },

      getLogsForEntity: (entityType, entityId) => {
        return get().logs.filter(l => l.entityType === entityType && l.entityId === entityId)
      },

      clearLogsForEntity: (entityType, entityId) => {
        set(s => ({
          logs: s.logs.filter(l => !(l.entityType === entityType && l.entityId === entityId)),
        }))
      },

      clearAllLogs: () => set({ logs: [] }),

      setPendingConfirmation: (pending) => set({ pendingConfirmation: pending }),

      resolvePendingConfirmation: (confirmed, excludeFields) => {
        const pending = get().pendingConfirmation
        if (pending) {
          pending.resolve(confirmed, excludeFields)
          set({ pendingConfirmation: null })
        }
      },

      setPendingDeleteConfirmation: (pending) => set({ pendingDeleteConfirmation: pending }),

      toggleDeleteItem: (toolCallId) => {
        const pending = get().pendingDeleteConfirmation
        if (!pending) return
        set({
          pendingDeleteConfirmation: {
            ...pending,
            items: pending.items.map(item =>
              item.toolCallId === toolCallId ? { ...item, checked: !item.checked } : item
            ),
          },
        })
      },

      toggleAllDeleteItems: (checked) => {
        const pending = get().pendingDeleteConfirmation
        if (!pending) return
        set({
          pendingDeleteConfirmation: {
            ...pending,
            items: pending.items.map(item => ({ ...item, checked })),
          },
        })
      },

      resolvePendingDeleteConfirmation: (confirmed) => {
        const pending = get().pendingDeleteConfirmation
        if (pending) {
          pending.resolve(confirmed ? pending.items.filter(i => i.checked) : [])
          set({ pendingDeleteConfirmation: null })
        }
      },
    }),
    {
      name: 'onion-flow-user-edit-logs',
      partialize: (state) => ({
        logs: state.logs,
      }),
    }
  )
)
