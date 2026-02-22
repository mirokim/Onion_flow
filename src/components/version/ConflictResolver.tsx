/**
 * ConflictResolver - Git-style merge UI for resolving data conflicts.
 * Used when restoring a snapshot that conflicts with current edits.
 */
import { useState } from 'react'
import { X, Check, ArrowLeft, ArrowRight } from 'lucide-react'

export interface ConflictItem {
  id: string
  category: string
  name: string
  currentValue: string
  snapshotValue: string
  resolution: 'current' | 'snapshot' | null
}

interface ConflictResolverProps {
  conflicts: ConflictItem[]
  onResolve: (resolved: ConflictItem[]) => void
  onCancel: () => void
}

export function ConflictResolver({ conflicts, onResolve, onCancel }: ConflictResolverProps) {
  const [items, setItems] = useState<ConflictItem[]>(conflicts)

  const setResolution = (id: string, resolution: 'current' | 'snapshot') => {
    setItems(prev => prev.map(item =>
      item.id === id ? { ...item, resolution } : item
    ))
  }

  const resolveAll = (resolution: 'current' | 'snapshot') => {
    setItems(prev => prev.map(item => ({ ...item, resolution })))
  }

  const allResolved = items.every(item => item.resolution !== null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-xl w-[700px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">충돌 해결</h2>
            <button
              onClick={onCancel}
              className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            {conflicts.length}개 항목에서 현재 상태와 스냅샷 간 충돌이 발생했습니다.
            각 항목에 대해 유지할 버전을 선택하세요.
          </p>
        </div>

        {/* Bulk actions */}
        <div className="px-4 py-2 border-b border-[var(--color-border)] flex gap-2">
          <button
            onClick={() => resolveAll('current')}
            className="text-xs px-3 py-1 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-1"
          >
            <ArrowLeft className="w-3 h-3" /> 모두 현재 유지
          </button>
          <button
            onClick={() => resolveAll('snapshot')}
            className="text-xs px-3 py-1 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors flex items-center gap-1"
          >
            모두 스냅샷 복원 <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {/* Conflict list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.map(item => (
            <div
              key={item.id}
              className="border border-[var(--color-border)] rounded-lg overflow-hidden"
            >
              {/* Conflict header */}
              <div className="px-3 py-2 bg-[var(--color-bg-secondary)] text-xs font-medium flex items-center gap-2">
                <span className="text-[var(--color-text-secondary)]">{item.category}</span>
                <span>/</span>
                <span>{item.name}</span>
                {item.resolution && (
                  <span className="ml-auto text-green-400 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    {item.resolution === 'current' ? '현재 유지' : '스냅샷 복원'}
                  </span>
                )}
              </div>

              {/* Side-by-side comparison */}
              <div className="grid grid-cols-2 divide-x divide-[var(--color-border)]">
                {/* Current */}
                <button
                  onClick={() => setResolution(item.id, 'current')}
                  className={`
                    p-3 text-left text-xs transition-colors cursor-pointer
                    ${item.resolution === 'current'
                      ? 'bg-blue-500/10 border-blue-500/30'
                      : 'hover:bg-[var(--color-bg-secondary)]'
                    }
                  `}
                >
                  <div className="text-[var(--color-text-secondary)] mb-1 font-medium">현재</div>
                  <div className="whitespace-pre-wrap break-words max-h-24 overflow-y-auto leading-relaxed">
                    {item.currentValue || '(비어 있음)'}
                  </div>
                </button>

                {/* Snapshot */}
                <button
                  onClick={() => setResolution(item.id, 'snapshot')}
                  className={`
                    p-3 text-left text-xs transition-colors cursor-pointer
                    ${item.resolution === 'snapshot'
                      ? 'bg-green-500/10 border-green-500/30'
                      : 'hover:bg-[var(--color-bg-secondary)]'
                    }
                  `}
                >
                  <div className="text-[var(--color-text-secondary)] mb-1 font-medium">스냅샷</div>
                  <div className="whitespace-pre-wrap break-words max-h-24 overflow-y-auto leading-relaxed">
                    {item.snapshotValue || '(비어 있음)'}
                  </div>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[var(--color-border)] flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {items.filter(i => i.resolution !== null).length}/{items.length} 해결됨
          </span>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] transition-colors"
            >
              취소
            </button>
            <button
              onClick={() => onResolve(items)}
              disabled={!allResolved}
              className={`
                text-xs px-4 py-1.5 rounded transition-colors
                ${allResolved
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] cursor-not-allowed'
                }
              `}
            >
              적용
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
