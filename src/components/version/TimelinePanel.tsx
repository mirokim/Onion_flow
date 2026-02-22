/**
 * TimelinePanel - Main timeline snapshot management UI.
 * Shows a vertical timeline of snapshots with create/restore/diff actions.
 */
import { useState, useEffect, useCallback } from 'react'
import { X, Plus, History, Loader2, AlertTriangle } from 'lucide-react'
import { useVersionStore } from '@/stores/versionStore'
import { useProjectStore } from '@/stores/projectStore'
import { SnapshotCard } from './SnapshotCard'
import { DiffViewer } from './DiffViewer'
import type { TimelineSnapshot } from '@/types'

interface TimelinePanelProps {
  onClose: () => void
}

export function TimelinePanel({ onClose }: TimelinePanelProps) {
  const currentProject = useProjectStore(s => s.currentProject)
  const {
    timelineSnapshots, loading,
    loadTimelineSnapshots, createTimelineSnapshot,
    restoreTimelineSnapshot, deleteTimelineSnapshot,
  } = useVersionStore()

  const [labelInput, setLabelInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const [creating, setCreating] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null)
  const [diffSnapshot, setDiffSnapshot] = useState<TimelineSnapshot | null>(null)

  useEffect(() => {
    if (currentProject) {
      loadTimelineSnapshots(currentProject.id)
    }
  }, [currentProject, loadTimelineSnapshots])

  const handleCreate = useCallback(async () => {
    if (!currentProject) return
    const label = labelInput.trim() || `스냅샷 ${new Date().toLocaleString('ko-KR')}`
    setCreating(true)
    try {
      await createTimelineSnapshot(currentProject.id, label)
      setLabelInput('')
      setShowInput(false)
    } catch (err) {
      console.error('[Timeline] Failed to create snapshot:', err)
    } finally {
      setCreating(false)
    }
  }, [currentProject, labelInput, createTimelineSnapshot])

  const handleRestore = useCallback(async (id: string) => {
    setRestoring(true)
    try {
      await restoreTimelineSnapshot(id)
      setConfirmRestore(null)
    } catch (err) {
      console.error('[Timeline] Failed to restore snapshot:', err)
    } finally {
      setRestoring(false)
    }
  }, [restoreTimelineSnapshot])

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteTimelineSnapshot(id)
    } catch (err) {
      console.error('[Timeline] Failed to delete snapshot:', err)
    }
  }, [deleteTimelineSnapshot])

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-stretch justify-end bg-black/30">
        <div className="w-[380px] bg-[var(--color-bg-primary)] border-l border-[var(--color-border)] flex flex-col shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-blue-400" />
              <h2 className="text-sm font-semibold">타임라인</h2>
              <span className="text-xs text-[var(--color-text-secondary)]">
                ({timelineSnapshots.length})
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Create snapshot */}
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            {showInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={labelInput}
                  onChange={e => setLabelInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  placeholder="스냅샷 이름..."
                  autoFocus
                  className="flex-1 text-sm px-2 py-1.5 rounded bg-[var(--color-bg-secondary)] border border-[var(--color-border)] outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                >
                  {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                  저장
                </button>
                <button
                  onClick={() => { setShowInput(false); setLabelInput('') }}
                  className="text-xs px-2 py-1.5 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors"
                >
                  취소
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowInput(true)}
                className="w-full text-sm px-3 py-2 rounded border border-dashed border-[var(--color-border)] hover:border-blue-500 hover:bg-blue-500/5 transition-colors flex items-center justify-center gap-2 text-[var(--color-text-secondary)]"
              >
                <Plus className="w-4 h-4" /> 현재 상태 스냅샷 저장
              </button>
            )}
          </div>

          {/* Timeline */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loading ? (
              <div className="flex items-center justify-center py-8 text-[var(--color-text-secondary)]">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="text-sm">로딩 중...</span>
              </div>
            ) : timelineSnapshots.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-8 h-8 text-[var(--color-text-secondary)] mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[var(--color-text-secondary)]">
                  아직 스냅샷이 없습니다
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                  위의 버튼으로 현재 상태를 저장하세요
                </p>
              </div>
            ) : (
              <div className="relative pl-5 border-l-2 border-[var(--color-border)] space-y-4">
                {timelineSnapshots.map((snap, i) => (
                  <SnapshotCard
                    key={snap.id}
                    snapshot={snap}
                    isFirst={i === 0}
                    onRestore={id => setConfirmRestore(id)}
                    onDelete={handleDelete}
                    onViewDiff={setDiffSnapshot}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Restore confirmation modal */}
      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-xl w-[400px] p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-semibold">스냅샷 복원</h3>
                <p className="text-xs text-[var(--color-text-secondary)] mt-2 leading-relaxed">
                  이 스냅샷으로 복원하면 현재 프로젝트의 <strong>모든 데이터</strong>
                  (캔버스, 본문, 위키, 세계관)가 스냅샷 시점으로 되돌아갑니다.
                  <br /><br />
                  복원 전 현재 상태를 자동으로 스냅샷 저장합니다. 계속하시겠습니까?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setConfirmRestore(null)}
                disabled={restoring}
                className="text-xs px-3 py-1.5 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  // Auto-save current state before restoring
                  if (currentProject) {
                    await createTimelineSnapshot(currentProject.id, `자동 저장 (복원 전)`)
                  }
                  handleRestore(confirmRestore)
                }}
                disabled={restoring}
                className="text-xs px-4 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-1"
              >
                {restoring && <Loader2 className="w-3 h-3 animate-spin" />}
                복원
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diff viewer modal */}
      {diffSnapshot && (
        <DiffViewer
          snapshot={diffSnapshot}
          onClose={() => setDiffSnapshot(null)}
        />
      )}
    </>
  )
}
