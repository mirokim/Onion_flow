/**
 * Undo-aware wrapper functions for wiki store mutations.
 * Each function performs the action and pushes an undo entry to undoStore.
 */
import { useWikiStore } from './wikiStore'
import { useUndoStore } from './undoStore'
import { getAdapter } from '@/db/storageAdapter'
import type { WikiEntry, WikiCategory } from '@/types'

/**
 * Create wiki entry with undo. Undo = delete the entry. Redo = re-insert.
 */
export async function createEntryWithUndo(
  projectId: string,
  category: WikiCategory,
  title: string,
): Promise<WikiEntry> {
  const entry = await useWikiStore.getState().createEntry(projectId, category, title)
  const snapshot: WikiEntry = { ...entry, tags: [...entry.tags] }

  useUndoStore.getState().pushUndo({
    label: `위키 생성: ${title || category}`,
    context: 'wiki',
    undo: async () => {
      await getAdapter().deleteWikiEntry(snapshot.id)
      useWikiStore.setState(s => ({
        entries: s.entries.filter(e => e.id !== snapshot.id),
        selectedEntryId: s.selectedEntryId === snapshot.id ? null : s.selectedEntryId,
      }))
    },
    redo: async () => {
      await getAdapter().insertWikiEntry(snapshot)
      useWikiStore.setState(s => ({
        entries: [...s.entries, snapshot],
      }))
    },
  })

  return entry
}

/**
 * Delete wiki entry with undo. Captures full entry before deletion.
 */
export async function deleteEntryWithUndo(entryId: string): Promise<void> {
  const entry = useWikiStore.getState().entries.find(e => e.id === entryId)
  if (!entry) return
  const snapshot: WikiEntry = { ...entry, tags: [...entry.tags] }

  await useWikiStore.getState().deleteEntry(entryId)

  useUndoStore.getState().pushUndo({
    label: `위키 삭제: ${entry.title || entry.category}`,
    context: 'wiki',
    undo: async () => {
      await getAdapter().insertWikiEntry(snapshot)
      useWikiStore.setState(s => ({
        entries: [...s.entries, snapshot],
      }))
    },
    redo: async () => {
      await useWikiStore.getState().deleteEntry(snapshot.id)
    },
  })
}

/**
 * Update wiki entry with undo. Captures old field values.
 * Uses coalescingKey for content edits to batch rapid typing into one undo step.
 */
export async function updateEntryWithUndo(
  entryId: string,
  updates: Partial<WikiEntry>,
  coalescingKey?: string,
): Promise<void> {
  const entry = useWikiStore.getState().entries.find(e => e.id === entryId)
  if (!entry) return

  // Capture only the fields being updated
  const oldValues: Partial<WikiEntry> = {}
  for (const key of Object.keys(updates) as Array<keyof WikiEntry>) {
    (oldValues as any)[key] = entry[key]
  }

  await useWikiStore.getState().updateEntry(entryId, updates)

  useUndoStore.getState().pushUndo({
    label: `위키 수정: ${entry.title}`,
    context: 'wiki',
    coalescingKey,
    undo: async () => {
      await useWikiStore.getState().updateEntry(entryId, oldValues)
    },
    redo: async () => {
      await useWikiStore.getState().updateEntry(entryId, updates)
    },
  })
}
