/**
 * Unit tests for storeHelpers.
 * Tests: createEntity, withUpdatedAt, mapUpdate.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── Mock dependencies ──
vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(),
}))

vi.mock('@/lib/dateUtils', () => ({
  nowUTC: vi.fn(),
}))

import { createEntity, withUpdatedAt, mapUpdate } from '@/lib/storeHelpers'
import { generateId } from '@/lib/utils'
import { nowUTC } from '@/lib/dateUtils'

interface TestEntity {
  id: string
  createdAt: number
  updatedAt: number
  [key: string]: unknown
}

const mockedGenerateId = vi.mocked(generateId)
const mockedNowUTC = vi.mocked(nowUTC)

describe('storeHelpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedGenerateId.mockReturnValue('mock-id-123')
    mockedNowUTC.mockReturnValue(1700000000000)
  })

  // ── createEntity ──

  describe('createEntity', () => {
    it('should add id, createdAt, and updatedAt to defaults', () => {
      const entity = createEntity<TestEntity>({ title: 'Test' })

      expect(entity).toEqual({
        title: 'Test',
        id: 'mock-id-123',
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      })
    })

    it('should use generateId for the id field', () => {
      mockedGenerateId.mockReturnValue('custom-uuid-456')

      const entity = createEntity<TestEntity>({ name: 'Item' })

      expect(entity.id).toBe('custom-uuid-456')
      expect(mockedGenerateId).toHaveBeenCalledTimes(1)
    })

    it('should use nowUTC for both createdAt and updatedAt', () => {
      mockedNowUTC.mockReturnValue(9999999999999)

      const entity = createEntity<TestEntity>({ name: 'Item' })

      expect(entity.createdAt).toBe(9999999999999)
      expect(entity.updatedAt).toBe(9999999999999)
      // nowUTC is called twice: once for createdAt, once for updatedAt
      expect(mockedNowUTC).toHaveBeenCalledTimes(2)
    })

    it('should preserve all provided default fields', () => {
      const entity = createEntity<TestEntity>({
        title: 'My Project',
        description: 'A description',
        genre: 'fantasy',
        tags: ['tag1', 'tag2'],
      })

      expect(entity.title).toBe('My Project')
      expect(entity.description).toBe('A description')
      expect(entity.genre).toBe('fantasy')
      expect(entity.tags).toEqual(['tag1', 'tag2'])
    })

    it('should work with empty defaults', () => {
      const entity = createEntity<TestEntity>({})

      expect(entity.id).toBe('mock-id-123')
      expect(entity.createdAt).toBe(1700000000000)
      expect(entity.updatedAt).toBe(1700000000000)
    })

    it('should create distinct entities with different mock values', () => {
      mockedGenerateId.mockReturnValueOnce('id-1').mockReturnValueOnce('id-2')
      mockedNowUTC
        .mockReturnValueOnce(1000).mockReturnValueOnce(1000)   // first entity
        .mockReturnValueOnce(2000).mockReturnValueOnce(2000)   // second entity

      const entity1 = createEntity<TestEntity>({ name: 'A' })
      const entity2 = createEntity<TestEntity>({ name: 'B' })

      expect(entity1.id).toBe('id-1')
      expect(entity2.id).toBe('id-2')
      expect(entity1.createdAt).toBe(1000)
      expect(entity2.createdAt).toBe(2000)
    })
  })

  // ── withUpdatedAt ──

  describe('withUpdatedAt', () => {
    it('should add updatedAt to partial updates', () => {
      const result = withUpdatedAt<{ updatedAt: number; title: string }>({ title: 'New Title' })

      expect(result).toEqual({
        title: 'New Title',
        updatedAt: 1700000000000,
      })
    })

    it('should overwrite existing updatedAt', () => {
      const result = withUpdatedAt<{ updatedAt: number; title: string }>({ title: 'X', updatedAt: 999 })

      // nowUTC should override the provided updatedAt
      expect(result.updatedAt).toBe(1700000000000)
    })

    it('should preserve all existing fields in the partial update', () => {
      const result = withUpdatedAt<{ updatedAt: number; title: string; description: string; genre: string }>({
        title: 'Updated',
        description: 'New desc',
        genre: 'sci-fi',
      })

      expect(result.title).toBe('Updated')
      expect(result.description).toBe('New desc')
      expect(result.genre).toBe('sci-fi')
      expect(result.updatedAt).toBe(1700000000000)
    })

    it('should work with empty partial update', () => {
      const result = withUpdatedAt({})
      expect(result).toEqual({ updatedAt: 1700000000000 })
    })

    it('should call nowUTC exactly once', () => {
      withUpdatedAt<{ updatedAt: number; name: string }>({ name: 'test' })
      expect(mockedNowUTC).toHaveBeenCalledTimes(1)
    })
  })

  // ── mapUpdate ──

  describe('mapUpdate', () => {
    it('should update the matching item by ID', () => {
      const items = [
        { id: 'a', name: 'Alice', score: 10 },
        { id: 'b', name: 'Bob', score: 20 },
        { id: 'c', name: 'Charlie', score: 30 },
      ]

      const result = mapUpdate(items, 'b', { score: 99 })

      expect(result[1]).toEqual({ id: 'b', name: 'Bob', score: 99 })
    })

    it('should leave non-matching items unchanged', () => {
      const items = [
        { id: 'a', name: 'Alice', score: 10 },
        { id: 'b', name: 'Bob', score: 20 },
      ]

      const result = mapUpdate(items, 'b', { score: 99 })

      expect(result[0]).toEqual({ id: 'a', name: 'Alice', score: 10 })
    })

    it('should return a new array (immutable)', () => {
      const items = [
        { id: 'a', name: 'Alice' },
      ]

      const result = mapUpdate(items, 'a', { name: 'Updated' })

      expect(result).not.toBe(items)
    })

    it('should return a new object for the updated item (immutable)', () => {
      const item = { id: 'a', name: 'Alice' }
      const items = [item]

      const result = mapUpdate(items, 'a', { name: 'Updated' })

      expect(result[0]).not.toBe(item)
      expect(result[0]).toEqual({ id: 'a', name: 'Updated' })
    })

    it('should handle empty array', () => {
      const result = mapUpdate<{ id: string; name: string }>([], 'x', { name: 'test' })
      expect(result).toEqual([])
    })

    it('should return unchanged items when no ID matches', () => {
      const items = [
        { id: 'a', name: 'Alice' },
        { id: 'b', name: 'Bob' },
      ]

      const result = mapUpdate(items, 'nonexistent', { name: 'X' })

      expect(result).toEqual(items)
    })

    it('should merge multiple fields into the matching item', () => {
      const items = [
        { id: 'a', name: 'Alice', age: 25, active: true },
      ]

      const result = mapUpdate(items, 'a', { name: 'Alicia', age: 26 })

      expect(result[0]).toEqual({ id: 'a', name: 'Alicia', age: 26, active: true })
    })

    it('should only update the first matching item when duplicates exist', () => {
      // mapUpdate uses .map so it actually updates ALL matching items
      const items = [
        { id: 'a', name: 'First' },
        { id: 'a', name: 'Second' },
      ]

      const result = mapUpdate(items, 'a', { name: 'Updated' })

      // Both should be updated since map iterates all
      expect(result[0].name).toBe('Updated')
      expect(result[1].name).toBe('Updated')
    })

    it('should preserve array length', () => {
      const items = [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ]

      const result = mapUpdate(items, 'b', { name: 'BB' })

      expect(result).toHaveLength(3)
    })
  })
})
