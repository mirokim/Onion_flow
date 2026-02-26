/**
 * VersionHistoryModal - Shows entity-level version history for a chapter or wiki entry.
 * Allows viewing, creating, and restoring versions.
 */
import { useEffect, useState } from 'react'
import { X, RotateCcw, Plus, Clock, User, Bot } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useVersionStore } from '@/stores/versionStore'
import { useProjectStore } from '@/stores/projectStore'
import { useWikiStore } from '@/stores/wikiStore'
import { formatDateUTC, formatRelativeTime } from '@/lib/dateUtils'
import { toast } from '@/components/common/Toast'
import type { EntityVersion, EntityType } from '@/types'

interface VersionHistoryModalProps {
  entityType: string
  entityId: string
  entityTitle: string
  onClose: () => void
}

export function VersionHistoryModal({ entityType, entityId, entityTitle, onClose }: VersionHistoryModalProps) {
  const versions = useVersionStore(s => s.versions)
  const loading = useVersionStore(s => s.loading)
  const loadVersions = useVersionStore(s => s.loadVersions)
  const createVersion = useVersionStore(s => s.createVersion)
  const currentProject = useProjectStore(s => s.currentProject)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (currentProject) {
      loadVersions(currentProject.id, entityType as EntityType, entityId)
    }
  }, [currentProject, entityType, entityId, loadVersions])

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleSaveCurrentVersion = async () => {
    if (!currentProject || saving) return
    setSaving(true)
    try {
      // Collect current data for the entity
      let data: Record<string, unknown> = {}
      if (entityType === 'chapter') {
        const chapter = useProjectStore.getState().chapters.find(c => c.id === entityId)
        if (chapter) data = { title: chapter.title, content: chapter.content, synopsis: chapter.synopsis, wordCount: chapter.wordCount }
      } else {
        const entry = useWikiStore.getState().entries.find(e => e.id === entityId)
        if (entry) data = { title: entry.title, content: entry.content, category: entry.category, tags: entry.tags }
      }
      await createVersion({
        projectId: currentProject.id,
        entityType: entityType as EntityType,
        entityId,
        data,
        label: '수동 저장',
        createdBy: 'user',
      })
      toast.success('현재 상태가 버전으로 저장되었습니다.')
    } finally {
      setSaving(false)
    }
  }

  const handleRestore = async (version: EntityVersion) => {
    try {
      if (entityType === 'chapter') {
        const { content, title, synopsis } = version.data as any
        if (content) {
          await useProjectStore.getState().updateChapterContent(entityId, content)
        }
        if (title || synopsis) {
          await useProjectStore.getState().updateChapter(entityId, {
            ...(title ? { title } : {}),
            ...(synopsis ? { synopsis } : {}),
          })
        }
      } else {
        const { content, title, tags } = version.data as any
        await useWikiStore.getState().updateEntry(entityId, {
          ...(content !== undefined ? { content } : {}),
          ...(title ? { title } : {}),
          ...(tags ? { tags } : {}),
        })
      }
      toast.success(`버전 ${version.versionNumber}이(가) 복원되었습니다.`)
      setConfirmRestore(null)
    } catch {
      toast.error('버전 복원에 실패했습니다.')
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-bg-surface border border-border rounded-xl shadow-2xl w-[420px] max-h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary truncate">버전 내역</h3>
            <p className="text-[10px] text-text-muted truncate">{entityTitle}</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Save current version button */}
        <div className="px-4 py-2 border-b border-border shrink-0">
          <button
            onClick={handleSaveCurrentVersion}
            disabled={saving}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-accent bg-accent/10 hover:bg-accent/20 rounded transition disabled:opacity-40"
          >
            <Plus className="w-3.5 h-3.5" />
            {saving ? '저장 중...' : '현재 상태를 버전으로 저장'}
          </button>
        </div>

        {/* Version list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="px-4 py-8 text-center text-xs text-text-muted">불러오는 중...</div>
          ) : versions.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-text-muted">버전 기록이 없습니다.</p>
              <p className="text-[10px] text-text-muted/60 mt-1">AI가 콘텐츠를 수정하면 자동으로 버전이 생성됩니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {versions.map(v => (
                <div key={v.id} className="px-4 py-2.5 hover:bg-bg-hover/50 transition">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-text-primary">v{v.versionNumber}</span>
                        <span className="text-[10px] text-text-muted truncate">{v.label}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {v.createdBy === 'ai' ? (
                          <Bot className="w-3 h-3 text-purple-400" />
                        ) : (
                          <User className="w-3 h-3 text-text-muted" />
                        )}
                        <span className="text-[10px] text-text-muted">
                          {formatRelativeTime(v.createdAt)}
                        </span>
                      </div>
                    </div>
                    {confirmRestore === v.id ? (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleRestore(v)}
                          className="text-[10px] px-2 py-0.5 bg-accent/20 text-accent rounded hover:bg-accent/30 transition"
                        >
                          확인
                        </button>
                        <button
                          onClick={() => setConfirmRestore(null)}
                          className="text-[10px] px-2 py-0.5 text-text-muted hover:bg-bg-hover rounded transition"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmRestore(v.id)}
                        className="shrink-0 text-[10px] px-2 py-0.5 text-text-muted hover:text-accent hover:bg-accent/10 rounded transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
