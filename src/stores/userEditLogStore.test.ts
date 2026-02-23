/**
 * Unit tests for userEditLogStore.
 * Tests: log CRUD, pending AI confirmation, pending delete confirmation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useUserEditLogStore } from './userEditLogStore'
import type {
  EditableEntityType,
  UserEditLogEntry,
  PendingAIConfirmation,
  PendingAIDeleteConfirmation,
  PendingDeleteItem,
} from './userEditLogStore'

vi.mock('@/lib/dateUtils', () => ({
  nowUTC: vi.fn(() => 1700000000000),
}))

function resetStore() {
  useUserEditLogStore.setState({
    logs: [],
    pendingConfirmation: null,
    pendingDeleteConfirmation: null,
  })
}

function makeLogEntry(overrides: Partial<Omit<UserEditLogEntry, 'id' | 'timestamp'>> = {}): Omit<UserEditLogEntry, 'id' | 'timestamp'> {
  return {
    entityType: 'character' as EditableEntityType,
    entityId: 'char-1',
    entityName: 'Hero',
    field: 'name',
    oldValue: 'Old Name',
    newValue: 'New Name',
    ...overrides,
  }
}

function makeDeleteItem(overrides: Partial<PendingDeleteItem> = {}): PendingDeleteItem {
  return {
    toolCallId: 'tc-1',
    toolName: 'delete_character',
    params: { id: 'char-1' },
    targetName: 'Hero',
    entityType: 'character',
    checked: true,
    ...overrides,
  }
}

describe('userEditLogStore', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  // ── addLog ──

  describe('addLog', () => {
    it('should add a new log entry with generated id and timestamp', () => {
      useUserEditLogStore.getState().addLog(makeLogEntry())

      const logs = useUserEditLogStore.getState().logs
      expect(logs).toHaveLength(1)
      expect(logs[0].entityType).toBe('character')
      expect(logs[0].entityId).toBe('char-1')
      expect(logs[0].field).toBe('name')
      expect(logs[0].newValue).toBe('New Name')
      expect(logs[0].timestamp).toBe(1700000000000)
      expect(logs[0].id).toMatch(/^uel_/)
    })

    it('should add multiple logs for different fields', () => {
      useUserEditLogStore.getState().addLog(makeLogEntry({ field: 'name' }))
      useUserEditLogStore.getState().addLog(makeLogEntry({ field: 'description' }))

      expect(useUserEditLogStore.getState().logs).toHaveLength(2)
    })

    it('should UPDATE existing log when same entityType + entityId + field exists', async () => {
      const { nowUTC } = await import('@/lib/dateUtils')

      useUserEditLogStore.getState().addLog(makeLogEntry({ field: 'name', oldValue: 'A', newValue: 'B' }))
      const originalId = useUserEditLogStore.getState().logs[0].id

      vi.mocked(nowUTC).mockReturnValue(1700000099999)
      useUserEditLogStore.getState().addLog(makeLogEntry({ field: 'name', oldValue: 'B', newValue: 'C' }))

      const logs = useUserEditLogStore.getState().logs
      expect(logs).toHaveLength(1)
      expect(logs[0].id).toBe(originalId)
      expect(logs[0].newValue).toBe('C')
      expect(logs[0].timestamp).toBe(1700000099999)
    })

    it('should add separate logs for different entities', () => {
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-1' }))
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-2' }))
      expect(useUserEditLogStore.getState().logs).toHaveLength(2)
    })
  })

  // ── getLogsForEntity ──

  describe('getLogsForEntity', () => {
    it('should return logs matching entityType and entityId', () => {
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-1', field: 'name' }))
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-1', field: 'description' }))
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-2', field: 'name' }))

      const result = useUserEditLogStore.getState().getLogsForEntity('character', 'char-1')
      expect(result).toHaveLength(2)
    })

    it('should return empty array when no logs match', () => {
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-1' }))
      expect(useUserEditLogStore.getState().getLogsForEntity('emotion', 'emo-1')).toHaveLength(0)
    })
  })

  // ── clearLogsForEntity ──

  describe('clearLogsForEntity', () => {
    it('should remove all logs for a specific entity', () => {
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-1', field: 'name' }))
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-1', field: 'desc' }))
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-2', field: 'name' }))

      useUserEditLogStore.getState().clearLogsForEntity('character', 'char-1')

      const logs = useUserEditLogStore.getState().logs
      expect(logs).toHaveLength(1)
      expect(logs[0].entityId).toBe('char-2')
    })
  })

  // ── clearAllLogs ──

  describe('clearAllLogs', () => {
    it('should remove all logs', () => {
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-1' }))
      useUserEditLogStore.getState().addLog(makeLogEntry({ entityId: 'char-2' }))
      useUserEditLogStore.getState().clearAllLogs()
      expect(useUserEditLogStore.getState().logs).toEqual([])
    })
  })

  // ── Pending AI Confirmation ──

  describe('setPendingConfirmation / resolvePendingConfirmation', () => {
    it('should set and resolve pending confirmation with confirmed=true', () => {
      const resolveFn = vi.fn()
      useUserEditLogStore.getState().setPendingConfirmation({
        id: 'confirm-1', toolName: 'update_character', params: {},
        entityType: 'character', entityId: 'char-1', entityName: 'Hero',
        userEditLogs: [], resolve: resolveFn,
      })

      expect(useUserEditLogStore.getState().pendingConfirmation).not.toBeNull()

      useUserEditLogStore.getState().resolvePendingConfirmation(true)
      expect(resolveFn).toHaveBeenCalledWith(true, undefined)
      expect(useUserEditLogStore.getState().pendingConfirmation).toBeNull()
    })

    it('should pass excludeFields to resolve', () => {
      const resolveFn = vi.fn()
      useUserEditLogStore.getState().setPendingConfirmation({
        id: 'confirm-1', toolName: 'update_character', params: {},
        entityType: 'character', entityId: 'char-1', entityName: 'Hero',
        userEditLogs: [], resolve: resolveFn,
      })

      useUserEditLogStore.getState().resolvePendingConfirmation(true, ['name'])
      expect(resolveFn).toHaveBeenCalledWith(true, ['name'])
    })

    it('should be a no-op when no pending confirmation', () => {
      useUserEditLogStore.getState().resolvePendingConfirmation(true)
      expect(useUserEditLogStore.getState().pendingConfirmation).toBeNull()
    })
  })

  // ── Pending Delete Confirmation ──

  describe('toggleDeleteItem', () => {
    it('should toggle checked state of a specific item', () => {
      useUserEditLogStore.getState().setPendingDeleteConfirmation({
        id: 'del-1',
        items: [
          makeDeleteItem({ toolCallId: 'tc-1', checked: true }),
          makeDeleteItem({ toolCallId: 'tc-2', checked: false }),
        ],
        resolve: vi.fn(),
      })

      useUserEditLogStore.getState().toggleDeleteItem('tc-1')

      const items = useUserEditLogStore.getState().pendingDeleteConfirmation!.items
      expect(items[0].checked).toBe(false)
      expect(items[1].checked).toBe(false)
    })

    it('should be a no-op when no pending delete', () => {
      useUserEditLogStore.getState().toggleDeleteItem('tc-1')
      expect(useUserEditLogStore.getState().pendingDeleteConfirmation).toBeNull()
    })
  })

  describe('toggleAllDeleteItems', () => {
    it('should set all items checked state', () => {
      useUserEditLogStore.getState().setPendingDeleteConfirmation({
        id: 'del-1',
        items: [
          makeDeleteItem({ toolCallId: 'tc-1', checked: false }),
          makeDeleteItem({ toolCallId: 'tc-2', checked: false }),
        ],
        resolve: vi.fn(),
      })

      useUserEditLogStore.getState().toggleAllDeleteItems(true)

      const items = useUserEditLogStore.getState().pendingDeleteConfirmation!.items
      expect(items.every(i => i.checked)).toBe(true)
    })
  })

  describe('resolvePendingDeleteConfirmation', () => {
    it('should resolve with checked items when confirmed', () => {
      const resolveFn = vi.fn()
      useUserEditLogStore.getState().setPendingDeleteConfirmation({
        id: 'del-1',
        items: [
          makeDeleteItem({ toolCallId: 'tc-1', checked: true }),
          makeDeleteItem({ toolCallId: 'tc-2', checked: false }),
          makeDeleteItem({ toolCallId: 'tc-3', checked: true }),
        ],
        resolve: resolveFn,
      })

      useUserEditLogStore.getState().resolvePendingDeleteConfirmation(true)

      const resolved = resolveFn.mock.calls[0][0] as PendingDeleteItem[]
      expect(resolved).toHaveLength(2)
      expect(resolved.map(i => i.toolCallId)).toEqual(['tc-1', 'tc-3'])
      expect(useUserEditLogStore.getState().pendingDeleteConfirmation).toBeNull()
    })

    it('should resolve with empty array when rejected', () => {
      const resolveFn = vi.fn()
      useUserEditLogStore.getState().setPendingDeleteConfirmation({
        id: 'del-1',
        items: [makeDeleteItem({ checked: true })],
        resolve: resolveFn,
      })

      useUserEditLogStore.getState().resolvePendingDeleteConfirmation(false)
      expect(resolveFn).toHaveBeenCalledWith([])
    })
  })
})
