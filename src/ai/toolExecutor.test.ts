/**
 * Unit tests for toolExecutor module.
 * Tests: queried chapter tracking, DELETE_TOOLS, resolveDeleteTargetInfo, executeTool pipeline.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/stores/worldStore', () => ({
  useWorldStore: {
    getState: vi.fn(() => ({
      characters: [],
      worldSettings: [],
      items: [],
      foreshadows: [],
    })),
  },
}))

vi.mock('@/stores/userEditLogStore', () => ({
  useUserEditLogStore: {
    getState: vi.fn(() => ({
      getLogsForEntity: vi.fn(() => []),
      clearLogsForEntity: vi.fn(),
      setPendingConfirmation: vi.fn(),
    })),
  },
}))

vi.mock('./toolValidation', () => ({
  validateToolParams: vi.fn((name: string, params: any) => ({ success: true, data: params })),
}))

vi.mock('./constants', async () => {
  const actual = await vi.importActual('./constants')
  return actual
})

vi.mock('./toolHandlers', () => ({
  TOOL_HANDLERS: {
    respond: vi.fn(async (p: any) => ({ success: true, result: p.message || '' })),
    update_character: vi.fn(async () => ({ success: true, result: 'updated' })),
    delete_character: vi.fn(async () => ({ success: true, result: 'deleted' })),
  },
}))

import {
  resetQueriedChapterIds,
  markChapterQueried,
  wasChapterQueried,
  DELETE_TOOLS,
  resolveDeleteTargetInfo,
  executeTool,
} from './toolExecutor'
import { useWorldStore } from '@/stores/worldStore'
import { validateToolParams } from './toolValidation'
import { TOOL_HANDLERS } from './toolHandlers'

// ── Queried Chapter Tracking ──

describe('queried chapter tracking', () => {
  beforeEach(() => {
    resetQueriedChapterIds()
  })

  it('wasChapterQueried returns false for unmarked chapter', () => {
    expect(wasChapterQueried('ch-1')).toBe(false)
  })

  it('wasChapterQueried returns true after marking', () => {
    markChapterQueried('ch-1')
    expect(wasChapterQueried('ch-1')).toBe(true)
  })

  it('wasChapterQueried returns false after reset', () => {
    markChapterQueried('ch-1')
    resetQueriedChapterIds()
    expect(wasChapterQueried('ch-1')).toBe(false)
  })
})

// ── DELETE_TOOLS ──

describe('DELETE_TOOLS', () => {
  it('contains exactly the 4 delete tool names', () => {
    expect(DELETE_TOOLS).toBeInstanceOf(Set)
    expect(DELETE_TOOLS.size).toBe(4)
    expect(DELETE_TOOLS.has('delete_character')).toBe(true)
    expect(DELETE_TOOLS.has('delete_world_setting')).toBe(true)
    expect(DELETE_TOOLS.has('delete_item')).toBe(true)
    expect(DELETE_TOOLS.has('delete_foreshadow')).toBe(true)
  })
})

// ── resolveDeleteTargetInfo ──

describe('resolveDeleteTargetInfo', () => {
  it('returns character name when character exists in store', () => {
    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [{ id: 'char-1', name: 'Alice' }],
      worldSettings: [],
      items: [],
      foreshadows: [],
    } as any)

    const result = resolveDeleteTargetInfo('delete_character', { characterId: 'char-1' })
    expect(result.targetName).toBe('Alice')
    expect(result.entityType).toBe('character')
  })

  it('returns characterId as targetName when character not found', () => {
    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [],
      worldSettings: [],
      items: [],
      foreshadows: [],
    } as any)

    const result = resolveDeleteTargetInfo('delete_character', { characterId: 'char-missing' })
    expect(result.targetName).toBe('char-missing')
    expect(result.entityType).toBe('character')
  })

  it('returns world setting title or settingId', () => {
    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [],
      worldSettings: [{ id: 'ws-1', title: 'Magic System' }],
      items: [],
      foreshadows: [],
    } as any)

    const found = resolveDeleteTargetInfo('delete_world_setting', { settingId: 'ws-1' })
    expect(found.targetName).toBe('Magic System')
    expect(found.entityType).toBe('world_setting')

    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [],
      worldSettings: [],
      items: [],
      foreshadows: [],
    } as any)

    const notFound = resolveDeleteTargetInfo('delete_world_setting', { settingId: 'ws-missing' })
    expect(notFound.targetName).toBe('ws-missing')
  })

  it('returns item name or itemId', () => {
    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [],
      worldSettings: [],
      items: [{ id: 'item-1', name: 'Excalibur' }],
      foreshadows: [],
    } as any)

    const found = resolveDeleteTargetInfo('delete_item', { itemId: 'item-1' })
    expect(found.targetName).toBe('Excalibur')
    expect(found.entityType).toBe('item')

    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [],
      worldSettings: [],
      items: [],
      foreshadows: [],
    } as any)

    const notFound = resolveDeleteTargetInfo('delete_item', { itemId: 'item-missing' })
    expect(notFound.targetName).toBe('item-missing')
  })

  it('returns foreshadow title or foreshadowId', () => {
    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [],
      worldSettings: [],
      items: [],
      foreshadows: [{ id: 'fs-1', title: 'The Prophecy' }],
    } as any)

    const found = resolveDeleteTargetInfo('delete_foreshadow', { foreshadowId: 'fs-1' })
    expect(found.targetName).toBe('The Prophecy')
    expect(found.entityType).toBe('foreshadow')

    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [],
      worldSettings: [],
      items: [],
      foreshadows: [],
    } as any)

    const notFound = resolveDeleteTargetInfo('delete_foreshadow', { foreshadowId: 'fs-missing' })
    expect(notFound.targetName).toBe('fs-missing')
  })

  it('returns correct entityType for each delete tool', () => {
    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [],
      worldSettings: [],
      items: [],
      foreshadows: [],
    } as any)

    expect(resolveDeleteTargetInfo('delete_character', { characterId: 'x' }).entityType).toBe('character')
    expect(resolveDeleteTargetInfo('delete_world_setting', { settingId: 'x' }).entityType).toBe('world_setting')
    expect(resolveDeleteTargetInfo('delete_item', { itemId: 'x' }).entityType).toBe('item')
    expect(resolveDeleteTargetInfo('delete_foreshadow', { foreshadowId: 'x' }).entityType).toBe('foreshadow')
  })
})

// ── executeTool ──

describe('executeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useWorldStore.getState).mockReturnValue({
      characters: [],
      worldSettings: [],
      items: [],
      foreshadows: [],
    } as any)
  })

  it('returns error when validation fails', async () => {
    vi.mocked(validateToolParams).mockReturnValueOnce({
      success: false,
      error: 'invalid params',
    } as any)

    const result = await executeTool('update_character', {}, 'proj-1')
    expect(result.success).toBe(false)
    expect(result.result).toBe('invalid params')
  })

  it('returns error when access scope is none', async () => {
    const noneScope = {
      characters: 'none' as const,
      worldSettings: 'none' as const,
      items: 'none' as const,
      foreshadows: 'none' as const,
      chapters: 'none' as const,
      referenceData: 'none' as const,
      relations: 'none' as const,
      emotions: 'none' as const,
      wiki: 'none' as const,
    }

    const result = await executeTool('update_character', {}, 'proj-1', noneScope)
    expect(result.success).toBe(false)
    expect(result.result).toContain('비활성화')
  })

  it('returns error with "알 수 없는 도구" for unknown tool', async () => {
    const result = await executeTool('nonexistent_tool', {}, 'proj-1')
    expect(result.success).toBe(false)
    expect(result.result).toContain('알 수 없는 도구')
    expect(result.result).toContain('nonexistent_tool')
  })

  it('calls handler and returns result on success', async () => {
    const result = await executeTool('update_character', { name: 'Bob' }, 'proj-1')
    expect(result.success).toBe(true)
    expect(result.result).toBe('updated')
    expect(TOOL_HANDLERS.update_character).toHaveBeenCalledWith({ name: 'Bob' }, 'proj-1')
  })

  it('returns error message when handler throws', async () => {
    vi.mocked(TOOL_HANDLERS.update_character as any).mockRejectedValueOnce(new Error('DB failure'))

    const result = await executeTool('update_character', {}, 'proj-1')
    expect(result.success).toBe(false)
    expect(result.result).toContain('오류')
    expect(result.result).toContain('DB failure')
  })

  it('respond tool returns message from params', async () => {
    const result = await executeTool('respond', { message: 'hello world' }, 'proj-1')
    expect(result.success).toBe(true)
    expect(result.result).toBe('hello world')
  })
})
