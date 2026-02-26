/**
 * BaseNode — Universal renderer for all non-group canvas nodes.
 * Looks up the node definition from the registry and renders handles/header dynamically.
 * Shows execution output (ComfyUI-style) when available.
 * Body rendering is dispatched to the appropriate plugin via NodeBodyRenderer.
 */
import { memo, useMemo, Fragment } from 'react'
import { Handle, Position, type NodeProps, useConnection } from '@xyflow/react'
import { getNodeDefinition, HANDLE_DATA_TYPE_COLORS, type HandleDataType } from '../index'
import { useCanvasStore } from '@/stores/canvasStore'
import { cn } from '@/lib/utils'
import { NodeBodyRenderer } from './NodeBodyRenderer'

interface BaseNodeData {
  label?: string
  nodeType: string
  nodeId?: string
  [key: string]: any
}

function BaseNodeComponent({ id, data, selected }: NodeProps & { data: BaseNodeData }) {
  const def = getNodeDefinition(data.nodeType)
  if (!def) return null

  const inputs = def.inputs
  const outputs = def.outputs

  // Hide handle labels when the node has >2 total handles: the labels would overlap with
  // body content at multiple positions across the node height (character, storyteller,
  // what_if, switch, smart_switch, etc.). Single-handle nodes keep their 50% labels.
  const hideHandleLabels = (inputs.length + outputs.length) > 2

  // ── Typed handle connection state ──
  const connection = useConnection()
  const isConnecting = connection.inProgress

  // While dragging from a source handle, derive the source's dataType
  // so incompatible TARGET handles on this node can be dimmed.
  const activeSourceDataType = useMemo<HandleDataType | undefined>(() => {
    if (!isConnecting || !connection.fromHandle || !connection.fromNode) return undefined
    // Only activate dimming when dragging FROM a source (not from a target)
    if ((connection.fromHandle as any).type !== 'source') return undefined
    const fromNodeType = (connection.fromNode.data as any)?.nodeType as string | undefined
    if (!fromNodeType) return undefined
    const fromNodeDef = getNodeDefinition(fromNodeType)
    if (!fromNodeDef) return undefined
    const srcHandle = fromNodeDef.outputs.find(h => h.id === (connection.fromHandle as any).id)
    return srcHandle?.dataType
  }, [isConnecting, connection.fromHandle, connection.fromNode])

  // Read execution output from store
  const nodeOutput = useCanvasStore(s =>
    data.nodeId ? s.nodeOutputs[data.nodeId] : undefined,
  )

  return (
    <div
      className={cn(
        'canvas-node relative overflow-visible rounded-lg shadow-md border-2 min-w-[160px]',
        data.nodeType === 'character' ? 'max-w-[320px]' : 'max-w-[280px]',
        'bg-bg-surface text-text-primary',
        selected ? 'border-accent shadow-accent/20' : 'border-border',
        nodeOutput?.status === 'running'  && 'border-yellow-500/60',
        nodeOutput?.status === 'waiting'  && 'border-blue-500/60',
        nodeOutput?.status === 'error'    && 'border-red-500/60',
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
        {nodeOutput?.status === 'waiting' && (
          <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0" />
        )}
        {nodeOutput?.status === 'error' && (
          <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
        )}
        <span className="truncate">{data.label || def.labelKo}</span>
      </div>

      {/* Body — dispatched to plugin via NodeBodyRenderer */}
      <div className="canvas-node-body px-3 py-2 text-xs text-text-secondary">
        <div className="flex items-center justify-between gap-1">
          {!hideHandleLabels && inputs.length > 0 ? (
            <span className="text-[8px] text-text-muted/70 shrink-0">{inputs[0].label}</span>
          ) : <span />}
          <span className="text-text-muted/60 uppercase tracking-wider text-[10px]">
            {def.category}
          </span>
          {!hideHandleLabels && outputs.length > 0 ? (
            <span className="text-[8px] text-text-muted/70 shrink-0 text-right">{outputs[0].label}</span>
          ) : <span />}
        </div>
        <NodeBodyRenderer nodeId={data.nodeId || id} data={data} selected={!!selected} />
      </div>

      {/* Execution Output (storyteller hides completed text — result goes to editor)
          'waiting' status: choices rendered inside body, skip this section */}
      {nodeOutput && nodeOutput.status !== 'idle' && nodeOutput.status !== 'queued' && nodeOutput.status !== 'waiting' && (
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

          {nodeOutput.status === 'completed' && data.nodeType !== 'storyteller' && nodeOutput.content && (
            <div className="px-3 py-2 max-h-[100px] overflow-y-auto">
              <p className="text-[10px] text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
                {nodeOutput.content.length > 300
                  ? nodeOutput.content.slice(0, 300) + '...'
                  : nodeOutput.content}
              </p>
            </div>
          )}

          {nodeOutput.status === 'completed' && data.nodeType === 'storyteller' && (
            <div className="px-3 py-1.5 text-[10px] text-green-400 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              생성 완료
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
      {inputs.map((input, i) => {
        const topPct = `${((i + 1) / (inputs.length + 1)) * 100}%`
        // Determine if this target handle is incompatible with the active drag
        let isDimmed = false
        if (isConnecting && activeSourceDataType !== undefined) {
          const accepts = input.acceptsTypes ?? ['*']
          const compatible =
            activeSourceDataType === '*' ||
            accepts.includes('*') ||
            accepts.includes(activeSourceDataType)
          isDimmed = !compatible
        }
        // Color: use the single accepted type's color, otherwise wildcard gray
        const accepts = input.acceptsTypes
        const handleColor: string = (() => {
          if (!accepts || accepts.includes('*') || accepts.length > 2) return HANDLE_DATA_TYPE_COLORS['*']
          return HANDLE_DATA_TYPE_COLORS[accepts[0] as HandleDataType] ?? HANDLE_DATA_TYPE_COLORS['*']
        })()

        return (
          <Fragment key={input.id}>
            <Handle
              type="target"
              position={Position.Left}
              id={input.id}
              className={cn(
                '!w-3 !h-3 !border-2 !border-bg-surface !transition-all !duration-150',
                isDimmed
                  ? '!opacity-20 !grayscale !cursor-not-allowed'
                  : 'hover:!scale-150',
              )}
              style={{ top: topPct, backgroundColor: handleColor }}
            />
            {/* Handle labels are now rendered inline in the body row above */}
          </Fragment>
        )
      })}

      {/* Output Handles */}
      {outputs.map((output, i) => {
        const topPct = `${((i + 1) / (outputs.length + 1)) * 100}%`
        const handleColor: string = output.dataType
          ? (HANDLE_DATA_TYPE_COLORS[output.dataType] ?? HANDLE_DATA_TYPE_COLORS['*'])
          : HANDLE_DATA_TYPE_COLORS['*']

        return (
          <Fragment key={output.id}>
            <Handle
              type="source"
              position={Position.Right}
              id={output.id}
              className="!w-3 !h-3 !border-2 !border-bg-surface hover:!scale-150 !transition-all !duration-150"
              style={{ top: topPct, backgroundColor: handleColor }}
            />
            {/* Handle labels are now rendered inline in the body row above */}
          </Fragment>
        )
      })}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
