import { useCanvasStore } from '@/stores/canvasStore'
import { cn } from '@/lib/utils'
import type { NodeBodyProps } from '../plugin'

const DEFAULT_READER_PERSONAS = ['사이다패스', '설정덕후', '감성독자', '비평가', '라이트유저']

export function VirtualReaderNodeBody({ nodeId, data }: NodeBodyProps) {
  const selectedPersonas = (data.selectedPersonas || data.personas || DEFAULT_READER_PERSONAS.slice(0, 3)) as string[]

  const togglePersona = (persona: string) => {
    const current = new Set(selectedPersonas)
    if (current.has(persona)) {
      current.delete(persona)
    } else {
      current.add(persona)
    }
    useCanvasStore.getState().updateNodeData(nodeId, { selectedPersonas: [...current] })
  }

  return (
    <div className="mt-1.5">
      <label className="block text-[9px] text-text-muted mb-1">독자 페르소나</label>
      <div className="flex flex-wrap gap-1">
        {DEFAULT_READER_PERSONAS.map(persona => {
          const isSelected = selectedPersonas.includes(persona)
          return (
            <button
              key={persona}
              onClick={(e) => { e.stopPropagation(); togglePersona(persona) }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] transition-all border',
                isSelected
                  ? 'bg-accent/20 text-accent border-accent/30 font-semibold'
                  : 'bg-bg-primary text-text-muted border-border hover:border-accent/30',
              )}
            >
              {persona}
            </button>
          )
        })}
      </div>
    </div>
  )
}
