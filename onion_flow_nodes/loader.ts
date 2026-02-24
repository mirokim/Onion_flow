/**
 * Dynamic node loader — ComfyUI-style.
 * Scans the onion_flow_nodes directory at startup for custom node definitions.
 * In web mode (no Electron), only built-in nodes are available.
 */
import type { NodeTypeDefinition } from './types'

/**
 * Load custom node definitions from the file system.
 * Each custom node lives in its own subfolder with a definition.json file.
 */
export async function loadCustomNodes(): Promise<NodeTypeDefinition[]> {
  const api = (window as any).electronAPI
  if (!api) return [] // Web mode: built-in nodes only

  try {
    const nodesDir: string = await api.getNodesDirectory()

    // Ensure the directory exists
    await api.createFolder(nodesDir)

    const result = await api.listFolder(nodesDir)
    if (!result.success || !result.data) return []

    const customs: NodeTypeDefinition[] = []

    for (const entry of result.data) {
      if (!entry.isDirectory) continue

      try {
        const defPath = `${nodesDir}/${entry.name}/definition.json`
        const defResult = await api.readProjectFile(nodesDir, `${entry.name}/definition.json`)

        if (defResult.success && defResult.data) {
          const def = JSON.parse(defResult.data) as NodeTypeDefinition
          // Validate required fields
          if (def.type && def.label && def.category && def.color) {
            customs.push({
              type: def.type,
              label: def.label,
              labelKo: def.labelKo || def.label,
              category: def.category,
              tags: Array.isArray(def.tags) ? def.tags : [def.category],
              color: def.color,
              description: def.description,
              descriptionKo: def.descriptionKo,
              author: def.author,
              version: def.version,
              inputs: Array.isArray(def.inputs) ? def.inputs : [],
              outputs: Array.isArray(def.outputs) ? def.outputs : [],
              defaultData: def.defaultData || {},
            })
          }
        }
      } catch {
        // Skip invalid definition files silently
      }
    }

    return customs
  } catch (err) {
    console.warn('Failed to load custom nodes:', err)
    return []
  }
}
