/**
 * Folder Save Scheduler — ensures project data is persisted to the file system
 * as the PRIMARY save destination. IndexedDB serves only as a backup.
 *
 * This module is called from the SQLite adapter's _markDirty() method so that
 * every single data change schedules a folder save (debounced to 3 seconds).
 *
 * Flow:
 *   Store action → SQLite adapter._run() → _markDirty()
 *     → IndexedDB backup (2s debounce, existing)
 *     → scheduleFolderSave() (3s debounce, this module)
 *       → gathers all store data → saveProjectToFolder() → writes storyflow.json + .md files
 */
import { saveProjectToFolder } from '@/db/projectSerializer'
import { getFileWriter } from '@/db/fileWriter'

let saveTimer: ReturnType<typeof setTimeout> | null = null
let saving = false
let pendingSave = false

const DEBOUNCE_MS = 3_000 // 3 seconds after last change

/**
 * Schedule a folder save. Called on every data change.
 * Debounces to batch rapid changes.
 */
export function scheduleFolderSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => performFolderSave(), DEBOUNCE_MS)
}

/**
 * Immediately save to folder. Used for lifecycle events (visibilitychange).
 * Clears any pending debounce timer.
 */
export async function saveNowToFolder(): Promise<void> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null }
  await performFolderSave()
}

/**
 * Gather all current store data and save to the project folder.
 * Skips if no project is loaded or no file writer is available.
 */
async function performFolderSave(): Promise<void> {
  if (saving) {
    // Already saving — mark pending so we retry after current save completes
    pendingSave = true
    return
  }

  saving = true
  try {
    // Lazy imports to avoid circular dependencies
    const { useProjectStore } = await import('@/stores/projectStore')
    const { useCanvasStore } = await import('@/stores/canvasStore')
    const { useWikiStore } = await import('@/stores/wikiStore')
    const { useWorldStore } = await import('@/stores/worldStore')

    const project = useProjectStore.getState().currentProject
    if (!project) return

    const writer = getFileWriter(project)
    if (!writer?.isAvailable()) return

    const { chapters } = useProjectStore.getState()
    const { nodes, wires } = useCanvasStore.getState()
    const { entries } = useWikiStore.getState()
    const worldState = useWorldStore.getState()

    const result = await saveProjectToFolder(writer, {
      project,
      chapters,
      canvasNodes: nodes.filter(n => n.projectId === project.id),
      canvasWires: wires.filter(w => w.projectId === project.id),
      wikiEntries: entries.filter(e => e.projectId === project.id),
      characters: worldState.characters,
      relations: worldState.relations,
      worldSettings: worldState.worldSettings,
      items: worldState.items,
      foreshadows: worldState.foreshadows,
      referenceData: worldState.referenceData,
    })

    if (result.success) {
      // Update save status store
      const { useSaveStatusStore } = await import('@/stores/saveStatusStore')
      useSaveStatusStore.getState().setSaved()
    } else {
      console.error('[FolderSave] Failed:', result.error)
    }
  } catch (err) {
    console.error('[FolderSave] Error:', err)
  } finally {
    saving = false
    // If another save was requested while we were saving, do it now
    if (pendingSave) {
      pendingSave = false
      scheduleFolderSave()
    }
  }
}
