import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeDefinition } from '../nodeRegistry'
import type { CanvasNodeType } from '@/types'
import { cn } from '@/lib/utils'

interface BaseNodeData {
  label?: string
  nodeType: CanvasNodeType
  [key: string]: any
}

function BaseNodeComponent({ data, selected }: NodeProps & { data: BaseNodeData }) {
  const def = getNodeDefinition(data.nodeType)
  if (!def) return null

  const inputs = def.inputs
  const outputs = def.outputs

  return (
    <div
      className={cn(
        'canvas-node rounded-lg shadow-md border-2 min-w-[160px] max-w-[280px]',
        'bg-bg-surface text-text-primary',
        selected ? 'border-accent shadow-accent/20' : 'border-border',
      )}
    >
      {/* Header */}
      <div
        className="canvas-node-header px-3 py-1.5 rounded-t-md text-xs font-semibold text-white truncate"
        style={{ backgroundColor: def.color }}
      >
        {data.label || def.labelKo}
      </div>

      {/* Body */}
      <div className="canvas-node-body px-3 py-2 text-xs text-text-secondary">
        <span className="text-text-muted/60 uppercase tracking-wider text-[10px]">
          {def.category}
        </span>
      </div>

      {/* Input Handles */}
      {inputs.map((input, i) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Left}
          id={input.id}
          className="!w-2.5 !h-2.5 !bg-text-muted !border-2 !border-bg-surface"
          style={{ top: `${((i + 1) / (inputs.length + 1)) * 100}%` }}
        />
      ))}

      {/* Output Handles */}
      {outputs.map((output, i) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Right}
          id={output.id}
          className="!w-2.5 !h-2.5 !bg-accent !border-2 !border-bg-surface"
          style={{ top: `${((i + 1) / (outputs.length + 1)) * 100}%` }}
        />
      ))}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
