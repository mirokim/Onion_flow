/**
 * Project Serializer — saves/loads projects to/from local folders.
 *
 * Folder structure:
 *   ProjectName/
 *   ├── project.json      ← Project metadata
 *   ├── canvas.json       ← { nodes: CanvasNode[], wires: CanvasWire[] }
 *   ├── manuscript.md     ← Chapters as Markdown
 *   └── wiki.md           ← Wiki entries as Markdown
 */
import type { Project, Chapter, CanvasNode, CanvasWire, WikiEntry } from '@/types'
import type { JSONContent } from '@tiptap/react'
import { nowUTC } from '@/lib/dateUtils'

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

// ── Save to folder ──

export async function saveProjectToFolder(
  folderPath: string,
  project: Project,
  chapters: Chapter[],
  canvasNodes: CanvasNode[],
  canvasWires: CanvasWire[],
  wikiEntries: WikiEntry[],
): Promise<{ success: boolean; error?: string }> {
  const api = window.electronAPI
  if (!api) return { success: false, error: 'Electron API not available' }

  try {
    // 1. project.json
    const projectMeta = {
      id: project.id,
      title: project.title,
      description: project.description,
      genre: project.genre,
      synopsis: project.synopsis,
      settings: project.settings,
      createdAt: project.createdAt,
      updatedAt: nowUTC(),
    }
    await api.writeProjectFile(folderPath, 'project.json', JSON.stringify(projectMeta, null, 2))

    // 2. canvas.json
    const canvasData = { nodes: canvasNodes, wires: canvasWires }
    await api.writeProjectFile(folderPath, 'canvas.json', JSON.stringify(canvasData, null, 2))

    // 3. manuscript.md
    const manuscriptMd = chaptersToMarkdown(chapters)
    await api.writeProjectFile(folderPath, 'manuscript.md', manuscriptMd)

    // 4. wiki.md
    const wikiMd = wikiEntriesToMarkdown(wikiEntries)
    await api.writeProjectFile(folderPath, 'wiki.md', wikiMd)

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' }
  }
}

// ── Load from folder ──

export async function loadProjectFromFolder(
  folderPath: string,
): Promise<{
  success: boolean
  error?: string
  project?: Partial<Project>
  canvasNodes?: CanvasNode[]
  canvasWires?: CanvasWire[]
}> {
  const api = window.electronAPI
  if (!api) return { success: false, error: 'Electron API not available' }

  try {
    // 1. Read project.json
    const projResult = await api.readProjectFile(folderPath, 'project.json')
    if (!projResult.success || !projResult.data) {
      return { success: false, error: 'project.json not found or unreadable' }
    }
    const project = JSON.parse(projResult.data) as Partial<Project>

    // 2. Read canvas.json
    let canvasNodes: CanvasNode[] = []
    let canvasWires: CanvasWire[] = []
    const canvasResult = await api.readProjectFile(folderPath, 'canvas.json')
    if (canvasResult.success && canvasResult.data) {
      const data = JSON.parse(canvasResult.data)
      canvasNodes = data.nodes || []
      canvasWires = data.wires || []
    }

    // manuscript.md and wiki.md are human-readable exports;
    // the authoritative data remains in the SQLite DB.
    // They can be parsed for import in a future version.

    return { success: true, project, canvasNodes, canvasWires }
  } catch (err: any) {
    return { success: false, error: err.message || 'Unknown error' }
  }
}
