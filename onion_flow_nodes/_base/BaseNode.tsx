/**
 * BaseNode — Universal renderer for all non-group canvas nodes.
 * Looks up the node definition from the registry and renders handles/header dynamically.
 * Shows execution output (ComfyUI-style) when available.
 */
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeDefinition } from '../index'
import { useCanvasStore, type NodeOutput } from '@/stores/canvasStore'
import { cn } from '@/lib/utils'

interface BaseNodeData {
  label?: string
  nodeType: string
  nodeId?: string
  [key: string]: any
}

function BaseNodeComponent({ data, selected }: NodeProps & { data: BaseNodeData }) {
  const def = getNodeDefinition(data.nodeType)
  if (!def) return null

  const inputs = def.inputs
  const outputs = def.outputs

  // Read execution output from store
  const nodeOutput = useCanvasStore(s =>
    data.nodeId ? s.nodeOutputs[data.nodeId] : undefined,
  )

  return (
    <div
      className={cn(
        'canvas-node rounded-lg shadow-md border-2 min-w-[160px] max-w-[280px]',
        'bg-bg-surface text-text-primary',
        selected ? 'border-accent shadow-accent/20' : 'border-border',
        nodeOutput?.status === 'running' && 'border-yellow-500/60',
        nodeOutput?.status === 'error' && 'border-red-500/60',
        nodeOutput?.status === 'completed' && 'border-green-500/40',
      )}
    >
      {/* Header */}
      <div
        className="canvas-node-header px-3 py-1.5 rounded-t-md text-xs font-semibold text-white truncate flex items-center gap-1.5"
        style={{ backgroundColor: def.color }}
      >
        {/* Status indicator */}
        {nodeOutput?.status === 'running' && (
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
        )}
        {nodeOutput?.status === 'queued' && (
          <div className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
        )}
        {nodeOutput?.status === 'completed' && (
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        )}
        {nodeOutput?.status === 'error' && (
          <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
        )}
        <span className="truncate">{data.label || def.labelKo}</span>
      </div>

      {/* Body */}
      <div className="canvas-node-body px-3 py-2 text-xs text-text-secondary">
        <span className="text-text-muted/60 uppercase tracking-wider text-[10px]">
          {def.category}
        </span>

        {/* Storyteller: Provider dropdown */}
        {data.nodeType === 'storyteller' && (
          <div className="mt-1.5">
            <select
              value={data.provider || ''}
              onChange={(e) => {
                e.stopPropagation()
                const value = e.target.value || null
                if (data.nodeId) {
                  useCanvasStore.getState().updateNodeData(data.nodeId, { provider: value })
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <option value="">기본 (글로벌 설정)</option>
              <option value="anthropic">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="grok">Grok</option>
              <option value="openai">GPT</option>
            </select>
          </div>
        )}
      </div>

      {/* Execution Output */}
      {nodeOutput && nodeOutput.status !== 'idle' && nodeOutput.status !== 'queued' && (
        <div className="border-t border-border">
          {nodeOutput.status === 'running' && (
            <div className="px-3 py-2 text-[10px] text-yellow-500 flex items-center gap-1.5">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              실행 중...
            </div>
          )}

          {nodeOutput.status === 'completed' && nodeOutput.content && (
            <div className="px-3 py-2 max-h-[100px] overflow-y-auto">
              <p className="text-[10px] text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
                {nodeOutput.content.length > 300
                  ? nodeOutput.content.slice(0, 300) + '...'
                  : nodeOutput.content}
              </p>
            </div>
          )}

          {nodeOutput.status === 'error' && (
            <div className="px-3 py-2">
              <p className="text-[10px] text-red-400 break-words">
                {nodeOutput.error || '실행 중 오류가 발생했습니다.'}
              </p>
            </div>
          )}
        </div>
      )}

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
