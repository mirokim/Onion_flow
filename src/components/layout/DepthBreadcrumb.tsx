import { useCanvasStore } from '@/stores/canvasStore'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export function DepthBreadcrumb() {
  const { t } = useTranslation()
  const { currentDepthPath, nodes, warpToDepth } = useCanvasStore()

  if (currentDepthPath.length === 0) return null

  const pathNodes = currentDepthPath.map(id => nodes.find(n => n.id === id))

  return (
    <div className="flex items-center gap-0.5 px-2 py-1 text-xs text-text-muted bg-bg-secondary/50 border-b border-border/50">
      <button
        onClick={() => warpToDepth(0)}
        className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-bg-hover hover:text-text-primary transition"
      >
        <Home className="w-3 h-3" />
        <span>{t('canvas.root')}</span>
      </button>

      {pathNodes.map((node, i) => (
        <div key={currentDepthPath[i]} className="flex items-center gap-0.5">
          <ChevronRight className="w-3 h-3 text-text-muted/40" />
          <button
            onClick={() => warpToDepth(i + 1)}
            className={cn(
              'px-1.5 py-0.5 rounded transition',
              i === pathNodes.length - 1
                ? 'text-accent font-medium'
                : 'hover:bg-bg-hover hover:text-text-primary',
            )}
          >
            {node?.data?.label || node?.type || `Node ${i + 1}`}
          </button>
        </div>
      ))}
    </div>
  )
}
