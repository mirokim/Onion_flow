/**
 * Store helper utilities to reduce boilerplate in Zustand stores.
 */
import { generateId } from './utils'
import { nowUTC } from './dateUtils'

/** Creates a new entity with generated ID and UTC timestamps. */
export function createEntity<T>(
  defaults: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
): T {
  return {
    ...defaults,
    id: generateId(),
    createdAt: nowUTC(),
    updatedAt: nowUTC(),
  } as unknown as T
}

/** Adds updatedAt timestamp to a partial update object. */
export function withUpdatedAt<T extends { updatedAt: number }>(
  updates: Partial<T>,
): Partial<T> {
  return { ...updates, updatedAt: nowUTC() }
}

/** Maps over items, updating the matching item by ID. */
export function mapUpdate<T extends { id: string }>(
  items: T[],
  id: string,
  merged: Partial<T>,
): T[] {
  return items.map(item => (item.id === id ? { ...item, ...merged } : item))
}
