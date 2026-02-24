import { useState, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X, Play, Square, ListPlus, ChevronUp, ChevronDown } from 'lucide-react'
import { NODE_REGISTRY, type NodeTypeDefinition } from '@nodes/index'
import { useCanvasStore } from '@/stores/canvasStore'
import { executeCanvas } from '@/ai/executionEngine'
import type { CanvasNodeCategory } from '@/types'
import { cn } from '@/lib/utils'
import { toast } from '@/components/common/Toast'

interface CanvasToolbarProps {
  onAddNode: (def: NodeTypeDefinition) => void
}

const CATEGORIES: { key: CanvasNodeCategory; label: string }[] = [
  { key: 'context', label: 'Context' },
  { key: 'direction', label: 'Direction' },
  { key: 'processing', label: 'Processing' },
  { key: 'special', label: 'Special' },
  { key: 'detector', label: 'Detector' },
  { key: 'output', label: 'Output' },
  { key: 'structure', label: 'Structure' },
  { key: 'plot', label: '플롯 애드온' },
]

export function CanvasToolbar({ onAddNode }: CanvasToolbarProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CanvasNodeCategory>('context')

  const isExecuting = useCanvasStore(s => s.isExecuting)
  const setIsExecuting = useCanvasStore(s => s.setIsExecuting)
  const setNodeOutput = useCanvasStore(s => s.setNodeOutput)
  const clearNodeOutputs = useCanvasStore(s => s.clearNodeOutputs)

  // Queue state
  const [queueTotal, setQueueTotal] = useState(1)
  const [queueCurrent, setQueueCurrent] = useState(0)
  const abortRef = useRef(false)

  const filteredNodes = NODE_REGISTRY.filter(n => n.category === selectedCategory)

  const handleRun = useCallback(async () => {
    if (isExecuting) return

    abortRef.current = false
    setIsExecuting(true)

    const total = queueTotal
    for (let i = 1; i <= total; i++) {
      if (abortRef.current) break

      setQueueCurrent(i)
      clearNodeOutputs()

      try {
        await executeCanvas((nodeId, output) => {
          setNodeOutput(nodeId, output)
        })
        if (total === 1) {
          toast.success(t('canvas.executionComplete', '실행 완료'))
        } else {
          toast.success(`실행 완료 (${i}/${total})`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        toast.error(`실행 오류 (${i}/${total}): ${msg}`)
        break
      }
    }

    setQueueCurrent(0)
    setIsExecuting(false)
  }, [isExecuting, setIsExecuting, clearNodeOutputs, setNodeOutput, t, queueTotal])

  const handleStop = useCallback(() => {
    abortRef.current = true
  }, [])

  return (
    <div className="absolute top-2 left-2 z-20 flex items-start gap-2">
      {/* Add Node button / panel */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-surface border border-border rounded-lg shadow-md text-xs font-medium text-text-primary hover:bg-bg-hover transition"
        >
          <Plus className="w-3.5 h-3.5" />
          {t('canvas.addNode')}
        </button>
      ) : (
        <div className="bg-bg-surface border border-border rounded-lg shadow-xl w-64 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-xs font-semibold text-text-primary">{t('canvas.addNode')}</span>
            <button onClick={() => setOpen(false)} className="text-text-muted hover:text-text-primary">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Category tabs */}
          <div className="flex border-b border-border">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                className={cn(
                  'flex-1 px-1 py-1.5 text-[10px] font-medium transition',
                  selectedCategory === cat.key
                    ? 'text-accent border-b-2 border-accent'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Node list */}
          <div className="max-h-[240px] overflow-y-auto py-1">
            {filteredNodes.map(def => (
              <button
                key={def.type}
                onClick={() => {
                  onAddNode(def)
                  setOpen(false)
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-bg-hover transition text-left"
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: def.color }}
                />
                <div>
                  <div className="text-xs text-text-primary">{def.labelKo}</div>
                  <div className="text-[10px] text-text-muted">{def.label}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* RUN button */}
      <button
        onClick={isExecuting ? handleStop : handleRun}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-md text-xs font-medium transition border',
          isExecuting
            ? 'bg-yellow-500/20 border-yellow-500/40 text-yellow-500 hover:bg-yellow-500/30'
            : 'bg-green-600 border-green-500 text-white hover:bg-green-700',
        )}
      >
        {isExecuting ? (
          <>
            <Square className="w-3.5 h-3.5" />
            {queueTotal > 1
              ? `${queueCurrent}/${queueTotal} 중지`
              : t('canvas.executing', '실행 중...')}
          </>
        ) : (
          <>
            <Play className="w-3.5 h-3.5" />
            {t('canvas.run', '실행')}
          </>
        )}
      </button>

      {/* Queue controls */}
      <div className="flex items-center gap-0.5 px-1.5 py-1.5 bg-bg-surface border border-border rounded-lg shadow-md text-xs font-medium">
        <button
          onClick={() => {
            if (!isExecuting) setQueueTotal(queueTotal + 1)
          }}
          disabled={isExecuting}
          className="text-text-muted hover:text-text-primary hover:bg-bg-hover transition disabled:opacity-40 rounded p-0.5"
          title="Queue 추가"
        >
          <ListPlus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setQueueTotal(Math.max(1, queueTotal - 1))}
          disabled={isExecuting || queueTotal <= 1}
          className="text-text-muted hover:text-text-primary transition disabled:opacity-40 rounded p-0.5"
        >
          <ChevronDown className="w-3 h-3" />
        </button>
        <span className="text-text-primary w-4 text-center tabular-nums">{queueTotal}</span>
        <button
          onClick={() => setQueueTotal(queueTotal + 1)}
          disabled={isExecuting}
          className="text-text-muted hover:text-text-primary transition disabled:opacity-40 rounded p-0.5"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
}
