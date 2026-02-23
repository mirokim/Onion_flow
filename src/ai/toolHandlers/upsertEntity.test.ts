/**
 * Unit tests for upsertEntity helper.
 * Tests: update by ID, ID not found, match by name, create new entity, version labeling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateVersion = vi.fn(async () => ({ versionNumber: 1 }))

vi.mock('@/stores/versionStore', () => ({
  useVersionStore: {
    getState: vi.fn(() => ({
      createVersion: mockCreateVersion,
    })),
  },
}))

import { upsertEntity, type UpsertConfig } from './upsertEntity'

function makeConfig(overrides: Partial<UpsertConfig<{ id: string; name: string }>> = {}): UpsertConfig<{ id: string; name: string }> {
  return {
    projectId: 'proj-1',
    entityType: 'character',
    entityId: undefined,
    findById: vi.fn(() => undefined),
    findByName: vi.fn(() => undefined),
    getId: (e) => e.id,
    create: vi.fn(async () => ({ id: 'new-1', name: 'Alice' })),
    update: vi.fn(async () => {}),
    updateData: { personality: 'brave' },
    versionData: { personality: 'brave' },
    displayName: 'Alice',
    entityLabel: '캐릭터',
    ...overrides,
  }
}

describe('upsertEntity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('updates existing entity by ID and creates version', async () => {
    const existing = { id: 'char-1', name: 'Alice' }
    const config = makeConfig({
      entityId: 'char-1',
      findById: vi.fn(() => existing),
    })

    const result = await upsertEntity(config)

    expect(result.success).toBe(true)
    expect(result.result).toContain('수정되었습니다')
    expect(config.update).toHaveBeenCalledWith('char-1', config.updateData)
    expect(mockCreateVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-1',
        entityType: 'character',
        entityId: 'char-1',
        createdBy: 'ai',
      }),
    )
  })

  it('returns error when entityId provided but not found', async () => {
    const config = makeConfig({
      entityId: 'char-missing',
      findById: vi.fn(() => undefined),
    })

    const result = await upsertEntity(config)

    expect(result.success).toBe(false)
    expect(result.result).toContain('char-missing')
    expect(result.result).toContain('찾을 수 없습니다')
    expect(config.update).not.toHaveBeenCalled()
    expect(mockCreateVersion).not.toHaveBeenCalled()
  })

  it('updates existing entity found by name when no ID provided', async () => {
    const existing = { id: 'char-2', name: 'Bob' }
    const config = makeConfig({
      entityId: undefined,
      findByName: vi.fn(() => existing),
      displayName: 'Bob',
    })

    const result = await upsertEntity(config)

    expect(result.success).toBe(true)
    expect(result.result).toContain('수정되었습니다')
    expect(config.update).toHaveBeenCalledWith('char-2', config.updateData)
    expect(mockCreateVersion).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'char-2' }),
    )
  })

  it('creates new entity when no ID and no name match', async () => {
    const created = { id: 'new-42', name: 'Carol' }
    const config = makeConfig({
      entityId: undefined,
      findByName: vi.fn(() => undefined),
      create: vi.fn(async () => created),
      displayName: 'Carol',
    })

    const result = await upsertEntity(config)

    expect(result.success).toBe(true)
    expect(result.result).toContain('생성되었습니다')
    expect(config.create).toHaveBeenCalled()
    expect(config.update).toHaveBeenCalledWith('new-42', config.updateData)
    expect(mockCreateVersion).toHaveBeenCalledWith(
      expect.objectContaining({ entityId: 'new-42' }),
    )
  })

  it('creates version with correct label including entityLabel and displayName', async () => {
    const existing = { id: 'char-1', name: 'Alice' }
    const config = makeConfig({
      entityId: 'char-1',
      findById: vi.fn(() => existing),
      entityLabel: '캐릭터',
      displayName: 'Alice',
    })

    await upsertEntity(config)

    expect(mockCreateVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        label: '캐릭터 수정: Alice',
      }),
    )

    // Verify create path uses different label
    vi.clearAllMocks()
    const configCreate = makeConfig({
      entityId: undefined,
      findByName: vi.fn(() => undefined),
      create: vi.fn(async () => ({ id: 'new-1', name: 'Diana' })),
      entityLabel: '아이템',
      displayName: 'Diana',
    })

    await upsertEntity(configCreate)

    expect(mockCreateVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        label: '아이템 생성: Diana',
      }),
    )
  })

  it('includes created entity ID in result message for new entities', async () => {
    const created = { id: 'gen-abc-123', name: 'Eve' }
    const config = makeConfig({
      entityId: undefined,
      findByName: vi.fn(() => undefined),
      create: vi.fn(async () => created),
      displayName: 'Eve',
    })

    const result = await upsertEntity(config)

    expect(result.success).toBe(true)
    expect(result.result).toContain('gen-abc-123')
    expect(result.result).toContain('ID:')
  })
})
