import { useEffect, useState } from 'react'
import { X, Trash2, RotateCcw, AlertTriangle } from 'lucide-react'
import { useTrashStore } from '@/stores/trashStore'
import { useProjectStore } from '@/stores/projectStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useWorldStore } from '@/stores/worldStore'
import { useCanvasStore } from '@/stores/canvasStore'
import type { TrashEntityType } from '@/types'

interface TrashPanelProps {
  onClose: () => void
}

const ENTITY_TYPE_LABELS: Record<TrashEntityType, string> = {
  wiki_entry: '위키',
  canvas_node: '캔버스 노드',
  character: '캐릭터',
  chapter: '챕터',
  world_setting: '세계관',
  item: '아이템',
  reference_data: '참고자료',
  foreshadow: '복선',
}

function formatDaysLeft(expiresAt: number): string {
  const days = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000))
  if (days <= 0) return '만료됨'
  if (days === 1) return '1일 남음'
  return `${days}일 남음`
}

function formatDeletedDate(deletedAt: number): string {
  const d = new Date(deletedAt)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

function getEntityTitle(entityData: Record<string, any>, entityType: TrashEntityType): string {
  switch (entityType) {
    case 'wiki_entry':
    case 'world_setting':
    case 'foreshadow':
    case 'reference_data':
      return entityData.title || 'Untitled'
    case 'character':
      return entityData.name || 'Untitled'
    case 'item':
      return entityData.name || 'Untitled'
    case 'chapter':
      return entityData.title || 'Untitled'
    case 'canvas_node':
      return entityData.data?.label || entityData.type || 'Node'
    default:
      return 'Untitled'
  }
}

/** Embeddable trash content (no modal wrapper) */
export function TrashContent() {
  const { currentProject } = useProjectStore()
  const { items, loading, loadTrash, restoreFromTrash, permanentlyDelete, emptyTrash } = useTrashStore()
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadTrash(currentProject.id)
    }
  }, [currentProject?.id])

  const handleRestore = async (trashItemId: string) => {
    const restored = await restoreFromTrash(trashItemId)
    if (!restored || !currentProject) return

    switch (restored.entityType) {
      case 'wiki_entry':
        await useWikiStore.getState().loadEntries(currentProject.id)
        break
      case 'character':
        await useWorldStore.getState().loadCharacters(currentProject.id)
        break
      case 'world_setting':
        await useWorldStore.getState().loadWorldSettings(currentProject.id)
        break
      case 'item':
        await useWorldStore.getState().loadItems(currentProject.id)
        break
      case 'foreshadow':
        await useWorldStore.getState().loadForeshadows(currentProject.id)
        break
      case 'canvas_node':
        await useCanvasStore.getState().loadCanvas(currentProject.id)
        break
      case 'chapter':
        await useProjectStore.getState().loadChapters(currentProject.id)
        break
    }
  }

  const handleEmptyTrash = async () => {
    if (!currentProject) return
    await emptyTrash(currentProject.id)
    setConfirmEmpty(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Action bar */}
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-border">
        <span className="text-xs text-text-muted">{items.length}개 항목</span>
        {items.length > 0 && (
          confirmEmpty ? (
            <div className="flex items-center gap-1">
              <span className="text-xs text-red-400">정말 비우시겠습니까?</span>
              <button
                onClick={handleEmptyTrash}
                className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition"
              >
                확인
              </button>
              <button
                onClick={() => setConfirmEmpty(false)}
                className="px-2 py-0.5 text-xs text-text-muted rounded hover:bg-bg-hover transition"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmEmpty(true)}
              className="px-2 py-1 text-xs text-red-400 rounded hover:bg-red-500/10 transition"
            >
              비우기
            </button>
          )
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-text-muted text-xs">
            로딩 중...
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <Trash2 className="w-8 h-8 text-text-muted/30" />
            <span className="text-xs text-text-muted">휴지통이 비어있습니다</span>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-2 py-2.5 hover:bg-bg-hover transition group rounded">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">
                      {getEntityTitle(item.entityData, item.entityType)}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-bg-hover rounded text-text-muted shrink-0">
                      {ENTITY_TYPE_LABELS[item.entityType]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-text-muted">
                      삭제: {formatDeletedDate(item.deletedAt)}
                    </span>
                    <span className="text-[10px] text-yellow-500/80">
                      {formatDaysLeft(item.expiresAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => handleRestore(item.id)}
                    className="p-1.5 rounded hover:bg-accent/10 text-accent"
                    title="복원"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => permanentlyDelete(item.id)}
                    className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                    title="영구 삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="pt-3 mt-3 border-t border-border">
        <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
          <AlertTriangle className="w-3 h-3" />
          <span>삭제된 항목은 30일 후 자동으로 영구 삭제됩니다</span>
        </div>
      </div>
    </div>
  )
}

export function TrashPanel({ onClose }: TrashPanelProps) {
  const { currentProject } = useProjectStore()
  const { items, loading, loadTrash, restoreFromTrash, permanentlyDelete, emptyTrash } = useTrashStore()
  const [confirmEmpty, setConfirmEmpty] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadTrash(currentProject.id)
    }
  }, [currentProject?.id])

  const handleRestore = async (trashItemId: string) => {
    const restored = await restoreFromTrash(trashItemId)
    if (!restored || !currentProject) return

    // Reload relevant store to reflect restored data
    switch (restored.entityType) {
      case 'wiki_entry':
        await useWikiStore.getState().loadEntries(currentProject.id)
        break
      case 'character':
        await useWorldStore.getState().loadCharacters(currentProject.id)
        break
      case 'world_setting':
        await useWorldStore.getState().loadWorldSettings(currentProject.id)
        break
      case 'item':
        await useWorldStore.getState().loadItems(currentProject.id)
        break
      case 'foreshadow':
        await useWorldStore.getState().loadForeshadows(currentProject.id)
        break
      case 'canvas_node':
        await useCanvasStore.getState().loadCanvas(currentProject.id)
        break
      case 'chapter':
        await useProjectStore.getState().loadChapters(currentProject.id)
        break
    }
  }

  const handleEmptyTrash = async () => {
    if (!currentProject) return
    await emptyTrash(currentProject.id)
    setConfirmEmpty(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-text-muted" />
            <h2 className="text-sm font-semibold text-text-primary">휴지통</h2>
            <span className="text-xs text-text-muted">({items.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              confirmEmpty ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-red-400">정말 비우시겠습니까?</span>
                  <button
                    onClick={handleEmptyTrash}
                    className="px-2 py-0.5 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition"
                  >
                    확인
                  </button>
                  <button
                    onClick={() => setConfirmEmpty(false)}
                    className="px-2 py-0.5 text-xs text-text-muted rounded hover:bg-bg-hover transition"
                  >
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmEmpty(true)}
                  className="px-2 py-1 text-xs text-red-400 rounded hover:bg-red-500/10 transition"
                >
                  비우기
                </button>
              )
            )}
            <button onClick={onClose} className="p-1 rounded hover:bg-bg-hover text-text-muted">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 text-text-muted text-xs">
              로딩 중...
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Trash2 className="w-8 h-8 text-text-muted/30" />
              <span className="text-xs text-text-muted">휴지통이 비어있습니다</span>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {items.map(item => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-bg-hover transition group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">
                        {getEntityTitle(item.entityData, item.entityType)}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-bg-hover rounded text-text-muted shrink-0">
                        {ENTITY_TYPE_LABELS[item.entityType]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-muted">
                        삭제: {formatDeletedDate(item.deletedAt)}
                      </span>
                      <span className="text-[10px] text-yellow-500/80">
                        {formatDaysLeft(item.expiresAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => handleRestore(item.id)}
                      className="p-1.5 rounded hover:bg-accent/10 text-accent"
                      title="복원"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => permanentlyDelete(item.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-red-400"
                      title="영구 삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-[10px] text-text-muted">
            <AlertTriangle className="w-3 h-3" />
            <span>삭제된 항목은 30일 후 자동으로 영구 삭제됩니다</span>
          </div>
        </div>
      </div>
    </div>
  )
}
