import { useMemo } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'

interface SwitchNodeBodyProps {
  data: Record<string, any>
  nodeId: string
}

export function SwitchNodeBody({ data, nodeId }: SwitchNodeBodyProps) {
  const storeWires = useCanvasStore(s => s.wires)
  const selected = (data.selectedInput as number) || 1

  // Find which inputs are actually connected
  const connectedInputs = useMemo(() => {
    const connected = new Set<number>()
    for (const w of storeWires) {
      if (w.targetNodeId === nodeId) {
        const match = w.targetHandle?.match(/^in_(\d+)$/)
        if (match) connected.add(Number(match[1]))
      }
    }
    return connected
  }, [storeWires, nodeId])

  const handleSelect = (idx: number) => {
    useCanvasStore.getState().updateNodeData(nodeId, { selectedInput: idx })
  }

  return (
    <div className="mt-1.5">
      <div className="flex flex-col gap-0.5">
        {[1, 2, 3, 4, 5].map(idx => {
          const isConnected = connectedInputs.has(idx)
          const isSelected = selected === idx

          return (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); handleSelect(idx) }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className={`
                flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] transition-all text-left
                ${isSelected
                  ? 'bg-green-500/20 text-green-400 font-semibold ring-1 ring-green-500/30'
                  : isConnected
                    ? 'bg-bg-primary text-text-secondary hover:bg-bg-hover'
                    : 'bg-bg-primary/50 text-text-muted/40 cursor-default'
                }
              `}
              disabled={!isConnected}
              title={isConnected ? `입력 ${idx} 선택` : '연결 없음'}
            >
              <span className={`
                w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 border
                ${isSelected
                  ? 'bg-green-500 text-white border-green-400'
                  : isConnected
                    ? 'bg-bg-surface border-border text-text-secondary'
                    : 'bg-bg-primary border-border/50 text-text-muted/30'
                }
              `}>
                {idx}
              </span>
              <span className="truncate">
                {isConnected
                  ? isSelected ? '● 활성' : '○ 대기'
                  : '—'
                }
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
