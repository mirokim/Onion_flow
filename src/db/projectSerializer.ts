/**
 * Project Serializer — saves/loads projects to/from local folders.
 *
 * Folder structure (3 files):
 *   ProjectFolder/
 *   ├── storyflow.json   ← Authoritative: project meta + canvas + world + chapters + wiki
 *   ├── manuscript.md    ← Human-readable: chapters as Markdown
 *   └── wiki.md          ← Human-readable: wiki entries as Markdown
 *
 * storyflow.json is the single source of truth for loading.
 * manuscript.md and wiki.md are derived outputs for human readability.
 */
import type {
  Project, Chapter, CanvasNode, CanvasWire, WikiEntry,
  Character, CharacterRelation, WorldSetting, Item, Foreshadow, ReferenceData,
  ProjectSettings,
} from '@/types'
import type { JSONContent } from '@tiptap/react'
import type { FileWriterHandle } from './fileWriter'
import { nowUTC } from '@/lib/dateUtils'

// ── StoryFlow JSON Schema ──

export interface StoryFlowFile {
  version: 1
  project: {
    id: string
    title: string
    description: string
    genre: string
    synopsis: string
    settings: ProjectSettings
    createdAt: number
    updatedAt: number
  }
  canvas: {
    nodes: CanvasNode[]
    wires: CanvasWire[]
  }
  world: {
    characters: Character[]
    relations: CharacterRelation[]
    worldSettings: WorldSetting[]
    items: Item[]
    foreshadows: Foreshadow[]
    referenceData: ReferenceData[]
  }
  chapters: Chapter[]
  wikiEntries: WikiEntry[]
}

// ── TipTap JSONContent → Markdown conversion (simplified) ──

function jsonContentToMarkdown(content: JSONContent | null): string {
  if (!content || !content.content) return ''

  const lines: string[] = []

  for (const node of content.content) {
    switch (node.type) {
      case 'paragraph':
        lines.push(extractText(node))
        lines.push('')
        break
      case 'heading': {
        const level = node.attrs?.level || 1
        const prefix = '#'.repeat(level)
        lines.push(`${prefix} ${extractText(node)}`)
        lines.push('')
        break
      }
      case 'bulletList':
        if (node.content) {
          for (const item of node.content) {
            lines.push(`- ${extractText(item)}`)
          }
          lines.push('')
        }
        break
      case 'orderedList':
        if (node.content) {
          node.content.forEach((item, i) => {
            lines.push(`${i + 1}. ${extractText(item)}`)
          })
          lines.push('')
        }
        break
      case 'blockquote':
        if (node.content) {
          for (const child of node.content) {
            lines.push(`> ${extractText(child)}`)
          }
          lines.push('')
        }
        break
      case 'codeBlock':
        lines.push('```')
        lines.push(extractText(node))
        lines.push('```')
        lines.push('')
        break
      case 'horizontalRule':
        lines.push('---')
        lines.push('')
        break
      default:
        lines.push(extractText(node))
        lines.push('')
    }
  }

  return lines.join('\n').trim()
}

function extractText(node: JSONContent): string {
  if (node.text) {
    let text = node.text
    if (node.marks) {
      for (const mark of node.marks) {
        if (mark.type === 'bold') text = `**${text}**`
        if (mark.type === 'italic') text = `*${text}*`
        if (mark.type === 'code') text = `\`${text}\``
        if (mark.type === 'strike') text = `~~${text}~~`
      }
    }
    return text
  }
  if (node.content) {
    return node.content.map(c => extractText(c)).join('')
  }
  return ''
}

// ── Manuscript serialization ──

function chaptersToMarkdown(chapters: Chapter[]): string {
  // Sort by hierarchy: volumes/top-level first, then by order
  const sorted = [...chapters].sort((a, b) => {
    if (a.parentId === null && b.parentId !== null) return -1
    if (a.parentId !== null && b.parentId === null) return 1
    return a.order - b.order
  })

  const lines: string[] = []

  for (const ch of sorted) {
    const isVolume = ch.type === 'volume'
    const prefix = isVolume ? '#' : '##'
    lines.push(`${prefix} ${ch.title}`)
    lines.push('')

    if (ch.synopsis) {
      lines.push(`> ${ch.synopsis}`)
      lines.push('')
    }

    const bodyMd = jsonContentToMarkdown(ch.content)
    if (bodyMd) {
      lines.push(bodyMd)
      lines.push('')
    }

    lines.push('---')
    lines.push('')
  }

  return lines.join('\n').trim()
}

// ── Wiki serialization ──

function wikiEntriesToMarkdown(entries: WikiEntry[]): string {
  const byCategory = new Map<string, WikiEntry[]>()

  for (const entry of entries) {
    const cat = entry.category || 'other'
    if (!byCategory.has(cat)) byCategory.set(cat, [])
    byCategory.get(cat)!.push(entry)
  }

  const lines: string[] = []

  for (const [category, items] of byCategory) {
    lines.push(`## ${category}`)
    lines.push('')

    for (const item of items.sort((a, b) => a.order - b.order)) {
      lines.push(`### ${item.title}`)
      lines.push('')
      if (item.content) {
        lines.push(item.content)
        lines.push('')
      }
      if (item.tags.length > 0) {
        lines.push(`Tags: ${item.tags.join(', ')}`)
        lines.push('')
      }
    }
  }

  return lines.join('\n').trim()
}

// ── Save to folder (3 files) ──

export interface SaveToFolderParams {
  project: Project
  chapters: Chapter[]
  canvasNodes: CanvasNode[]
  canvasWires: CanvasWire[]
  wikiEntries: WikiEntry[]
  characters: Character[]
  relations: CharacterRelation[]
  worldSettings: WorldSetting[]
  items: Item[]
  foreshadows: Foreshadow[]
  referenceData: ReferenceData[]
}

export async function saveProjectToFolder(
  writer: FileWriterHandle,
  params: SaveToFolderParams,
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      project, chapters, canvasNodes, canvasWires, wikiEntries,
      characters, relations, worldSettings, items, foreshadows, referenceData,
    } = params

    // 1. storyflow.json — authoritative structured data
    const storyflow: StoryFlowFile = {
      version: 1,
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        genre: project.genre,
        synopsis: project.synopsis,
        settings: project.settings,
        createdAt: project.createdAt,
        updatedAt: nowUTC(),
      },
      canvas: {
        nodes: canvasNodes,
        wires: canvasWires,
      },
      world: {
        characters,
        relations,
        worldSettings,
        items,
        foreshadows,
        referenceData,
      },
      chapters,
      wikiEntries,
    }
    await writer.writeFile('storyflow.json', JSON.stringify(storyflow, null, 2))

    // 2. manuscript.md — human-readable Markdown
    const manuscriptMd = chaptersToMarkdown(chapters)
    await writer.writeFile('manuscript.md', manuscriptMd)

    // 3. wiki.md — human-readable Markdown
    const wikiMd = wikiEntriesToMarkdown(wikiEntries)
    await writer.writeFile('wiki.md', wikiMd)

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' }
  }
}

// ── Load from folder ──

export interface LoadFromFolderResult {
  success: boolean
  error?: string
  data?: StoryFlowFile
}

export async function loadProjectFromFolder(
  writer: FileWriterHandle,
): Promise<LoadFromFolderResult> {
  try {
    // Try storyflow.json first (new format)
    const storyflowRaw = await writer.readFile('storyflow.json')

    if (storyflowRaw) {
      const data = JSON.parse(storyflowRaw) as StoryFlowFile
      return { success: true, data }
    }

    // Legacy fallback: try project.json + canvas.json (old 4-file format)
    const projectRaw = await writer.readFile('project.json')
    if (!projectRaw) {
      return { success: false, error: 'storyflow.json not found' }
    }

    const projectMeta = JSON.parse(projectRaw) as Partial<Project>
    let canvasNodes: CanvasNode[] = []
    let canvasWires: CanvasWire[] = []

    const canvasRaw = await writer.readFile('canvas.json')
    if (canvasRaw) {
      const canvasData = JSON.parse(canvasRaw)
      canvasNodes = canvasData.nodes || []
      canvasWires = canvasData.wires || []
    }

    // Build a StoryFlowFile from legacy data
    const legacyData: StoryFlowFile = {
      version: 1,
      project: {
        id: projectMeta.id || '',
        title: projectMeta.title || 'Imported Project',
        description: projectMeta.description || '',
        genre: projectMeta.genre || '',
        synopsis: projectMeta.synopsis || '',
        settings: projectMeta.settings || { language: 'ko', targetDailyWords: 3000, readingSpeedCPM: 500 },
        createdAt: projectMeta.createdAt || Date.now(),
        updatedAt: projectMeta.updatedAt || Date.now(),
      },
      canvas: { nodes: canvasNodes, wires: canvasWires },
      world: {
        characters: [],
        relations: [],
        worldSettings: [],
        items: [],
        foreshadows: [],
        referenceData: [],
      },
      chapters: [],
      wikiEntries: [],
    }

    return { success: true, data: legacyData }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' }
  }
}
