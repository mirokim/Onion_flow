/**
 * GroupNode - Visual container for grouping nodes on the canvas.
 * Rendered as a resizable, semi-transparent panel.
 */
import { memo } from 'react'
import { NodeResizer, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'
import { NODE_CATEGORY_COLORS } from '../nodeRegistry'

interface GroupNodeData {
  label?: string
  [key: string]: any
}

function GroupNodeComponent({ data, selected }: NodeProps & { data: GroupNodeData }) {
  return (
    <div
      className={cn(
        'rounded-xl min-w-[200px] min-h-[150px] w-full h-full',
        selected ? 'ring-2 ring-accent' : '',
      )}
      style={{
        backgroundColor: `${NODE_CATEGORY_COLORS.structure}15`,
        border: `2px dashed ${NODE_CATEGORY_COLORS.structure}60`,
      }}
    >
      <NodeResizer
        color={NODE_CATEGORY_COLORS.structure}
        isVisible={selected}
        minWidth={200}
        minHeight={150}
      />
      <div
        className="absolute top-0 left-0 px-3 py-1 rounded-tl-lg rounded-br-lg text-xs font-semibold text-white"
        style={{ backgroundColor: NODE_CATEGORY_COLORS.structure }}
      >
        {data.label || 'Group'}
      </div>
    </div>
  )
}

export const GroupNode = memo(GroupNodeComponent)
