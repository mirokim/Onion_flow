/**
 * ChapterPanel — Volume/Chapter tree management panel.
 * Displays a hierarchical tree of volumes and chapters with inline actions.
 */
import { useState, useCallback } from 'react'
import {
  ChevronRight, ChevronDown, Plus, Trash2, BookOpen, FolderPlus,
  LayoutTemplate, FileText,
} from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import type { ChapterTreeItem } from '@/types'
import { PanelTabBar, type PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { useEditorStore } from '@/stores/editorStore'
import { cn } from '@/lib/utils'
import { CHAPTER_TEMPLATES, type ChapterTemplate, type ChapterTemplateItem } from './chapterTemplates'
import { toast } from '@/components/common/Toast'

function ChapterTreeNode({
  item,
  depth,
  selectedId,
  onSelect,
  onDelete,
  onToggle,
}: {
  item: ChapterTreeItem
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onToggle: (id: string) => void
}) {
  const isVolume = item.type === 'volume'
  const isSelected = item.id === selectedId
  const hasChildren = item.children.length > 0

  return (
    <div>
      <div
        className={cn(
          'group flex items-center gap-1 px-2 py-1 rounded cursor-pointer transition-colors text-xs',
          isSelected ? 'bg-accent/20 text-accent' : 'hover:bg-bg-hover text-text-primary',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          if (isVolume) onToggle(item.id)
          onSelect(item.id)
        }}
      >
        {/* Expand/collapse for volumes */}
        {isVolume ? (
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(item.id) }}
            className="shrink-0 text-text-muted hover:text-text-primary"
          >
            {item.isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <FileText className="w-3.5 h-3.5 shrink-0 text-text-muted" />
        )}

        {/* Icon */}
        {isVolume && <BookOpen className="w-3.5 h-3.5 shrink-0 text-accent/70" />}

        {/* Title */}
        <span className={cn('truncate flex-1', isVolume && 'font-semibold')}>
          {item.title}
        </span>

        {/* Word count */}
        {!isVolume && item.wordCount > 0 && (
          <span className="text-[10px] text-text-muted shrink-0">{item.wordCount.toLocaleString()}</span>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-text-muted hover:text-red-400 transition"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {/* Children */}
      {isVolume && item.isExpanded && hasChildren && (
        <div>
          {item.children.map(child => (
            <ChapterTreeNode
              key={child.id}
              item={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ChapterPanelProps {
  panelDragHandlers?: PanelDragHandlers
}

export function ChapterPanel({ panelDragHandlers }: ChapterPanelProps) {
  const currentProject = useProjectStore(s => s.currentProject)
  const currentChapter = useProjectStore(s => s.currentChapter)
  const chapters = useProjectStore(s => s.chapters)
  const getChapterTree = useProjectStore(s => s.getChapterTree)
  const createChapter = useProjectStore(s => s.createChapter)
  const selectChapter = useProjectStore(s => s.selectChapter)
  const deleteChapter = useProjectStore(s => s.deleteChapter)
  const toggleExpanded = useProjectStore(s => s.toggleExpanded)

  const toggleTab = useEditorStore(s => s.toggleTab)
  const pinnedPanels = useEditorStore(s => s.pinnedPanels)
  const togglePanelPin = useEditorStore(s => s.togglePanelPin)
  const [showTemplates, setShowTemplates] = useState(false)

  const tree = getChapterTree()

  const handleAddChapter = useCallback(async () => {
    if (!currentProject) {
      toast.warning('프로젝트를 먼저 생성하세요.')
      return
    }
    const ch = await createChapter(`챕터 ${chapters.length + 1}`)
    selectChapter(ch.id)
  }, [currentProject, createChapter, chapters.length, selectChapter])

  const handleAddVolume = useCallback(async () => {
    if (!currentProject) {
      toast.warning('프로젝트를 먼저 생성하세요.')
      return
    }
    await createChapter(`볼륨 ${chapters.filter(c => c.type === 'volume').length + 1}`, null, 'volume')
  }, [currentProject, createChapter, chapters])

  const handleDelete = useCallback(async (id: string) => {
    await deleteChapter(id)
  }, [deleteChapter])

  const handleApplyTemplate = useCallback(async (template: ChapterTemplate) => {
    if (!currentProject) return

    const applyItems = async (items: ChapterTemplateItem[], parentId: string | null) => {
      for (const item of items) {
        const ch = await createChapter(item.title, parentId, item.type)
        if (item.children && item.children.length > 0) {
          await applyItems(item.children, ch.id)
        }
      }
    }

    await applyItems(template.structure, null)
    setShowTemplates(false)
    toast.success(`"${template.nameKo}" 템플릿이 적용되었습니다.`)
  }, [currentProject, createChapter])

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-4 text-text-muted text-xs">
        프로젝트를 먼저 선택하세요.
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-bg-primary">
      {/* Header — PanelTabBar for consistency */}
      <PanelTabBar
        tabs={[{ id: 'chapters', label: '볼륨/챕터', isPinned: pinnedPanels.includes('chapters') }]}
        activeTabId="chapters"
        onSelect={() => {}}
        onClose={() => toggleTab('chapters')}
        onTogglePin={() => togglePanelPin('chapters')}
        panelDragHandlers={panelDragHandlers}
        actions={
          <>
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition"
              title="템플릿"
            >
              <LayoutTemplate className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleAddVolume}
              className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition"
              title="볼륨 추가"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleAddChapter}
              className="p-1 rounded text-text-muted hover:text-accent hover:bg-bg-hover transition"
              title="챕터 추가"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </>
        }
      />

      {/* Template picker */}
      {showTemplates && (
        <div className="border-b border-border bg-bg-secondary p-2 shrink-0">
          <p className="text-[10px] text-text-muted mb-1.5 font-medium">템플릿 선택</p>
          <div className="flex flex-col gap-1">
            {CHAPTER_TEMPLATES.map(tpl => (
              <button
                key={tpl.id}
                onClick={() => handleApplyTemplate(tpl)}
                className="text-left px-2 py-1.5 rounded hover:bg-bg-hover transition"
              >
                <div className="text-xs text-text-primary font-medium">{tpl.nameKo}</div>
                <div className="text-[10px] text-text-muted">{tpl.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tree view */}
      <div className="flex-1 overflow-y-auto py-1">
        {tree.length === 0 ? (
          <div className="px-3 py-4 text-center text-text-muted text-xs">
            챕터가 없습니다. 위 버튼으로 추가하거나<br />템플릿을 적용하세요.
          </div>
        ) : (
          tree.map(item => (
            <ChapterTreeNode
              key={item.id}
              item={item}
              depth={0}
              selectedId={currentChapter?.id || null}
              onSelect={selectChapter}
              onDelete={handleDelete}
              onToggle={toggleExpanded}
            />
          ))
        )}
      </div>
    </div>
  )
}
