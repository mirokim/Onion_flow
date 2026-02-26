/**
 * Output node plugins: save_content, preview_content
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import type { NodeBodyProps } from '../plugin'
import { useCanvasStore } from '@/stores/canvasStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useProjectStore } from '@/stores/projectStore'
import { textToTipTapContent } from '@/ai/contentConverter'
import { getTextFromContent } from '@/lib/utils'

// ── save_content ──────────────────────────────────────────────────────────────

function SaveContentNodeBody({ nodeId, data }: NodeBodyProps) {
  const saveTarget = (data.saveTarget as 'wiki' | 'chapter') || 'wiki'

  return (
    <div className="mt-1.5">
      <select
        value={saveTarget}
        onChange={(e) => {
          e.stopPropagation()
          useCanvasStore.getState().updateNodeData(nodeId, { saveTarget: e.target.value })
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
      >
        <option value="wiki">위키에 저장</option>
        <option value="chapter">본문에 저장 (새 챕터)</option>
      </select>
    </div>
  )
}

registerPlugin({
  definition: {
    type: 'save_content',
    label: 'Save Content',
    labelKo: '콘텐츠 저장',
    category: 'output',
    tags: ['output'],
    color: NODE_CATEGORY_COLORS.output,
    inputs: [{ id: 'content', label: 'Content', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [],
    defaultData: { filename: 'content.md', saveTarget: 'wiki', label: 'Save Content' },
  },
  bodyComponent: SaveContentNodeBody,
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    if (!context) return '저장할 콘텐츠가 없습니다.'
    const { nodes } = useCanvasStore.getState()
    const projectId = node.projectId || nodes[0]?.projectId
    if (!projectId) return '프로젝트 ID를 찾을 수 없습니다.'

    const saveTarget = (node.data.saveTarget as string) || 'wiki'

    // Collect character names from upstream nodes for tags
    const wikiEntries = useWikiStore.getState().entries
    const { wires } = useCanvasStore.getState()
    const characterTags: string[] = []
    const visited = new Set<string>()
    const collectCharNames = (nodeId: string) => {
      if (visited.has(nodeId)) return
      visited.add(nodeId)
      const incoming = wires.filter(w => w.targetNodeId === nodeId)
      for (const wire of incoming) {
        const srcNode = nodes.find(n => n.id === wire.sourceNodeId)
        if (!srcNode) continue
        if (srcNode.type === 'character' && srcNode.data.wikiEntryId) {
          const entry = wikiEntries.find(e => e.id === srcNode.data.wikiEntryId)
          if (entry?.title) characterTags.push(entry.title)
        }
        collectCharNames(srcNode.id)
      }
    }
    collectCharNames(node.id)

    const dateTag = new Date().toISOString().slice(0, 10)
    const title = `Content - ${new Date().toLocaleString('ko-KR')}`
    const tags = [dateTag, ...characterTags]

    if (saveTarget === 'chapter') {
      // Save as new chapter
      const chapter = await useProjectStore.getState().createChapter(title)
      const jsonContent = textToTipTapContent(context)
      const plainText = getTextFromContent(jsonContent)
      const wordCount = plainText.replace(/\s/g, '').length
      await useProjectStore.getState().updateChapterContent(chapter.id, jsonContent)
      await useProjectStore.getState().updateChapter(chapter.id, { wordCount })
      return `본문 챕터 "${title}" 생성 완료 (${wordCount}자)\n\n---\n\n${context}`
    }

    // Default: save to wiki
    const wikiStore = useWikiStore.getState()
    const entry = await wikiStore.createEntry(projectId, 'story', title)
    await wikiStore.updateEntry(entry.id, { content: context, tags })

    return `위키에 "${title}" 저장 완료 (${context.length}자, 태그: ${tags.join(', ')})\n\n---\n\n${context}`
  },
})

// ── preview_content ───────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'preview_content',
    label: 'Preview Content',
    labelKo: '콘텐츠 미리보기',
    category: 'output',
    tags: ['output'],
    color: NODE_CATEGORY_COLORS.output,
    inputs: [{ id: 'content', label: 'Content', type: 'target', position: 'left', acceptsTypes: ['TEXT'] }],
    outputs: [],
    defaultData: { label: 'Preview Content' },
  },
  isExecutable: true,
  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    if (!context) return '미리볼 콘텐츠가 없습니다.'
    return context
  },
})
