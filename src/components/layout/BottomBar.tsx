import { useTranslation } from 'react-i18next'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { formatNumber } from '@/lib/utils'

export function BottomBar() {
  const { t } = useTranslation()
  const { focusMode } = useEditorStore()
  const { getTotalWordCount, currentChapter } = useProjectStore()
  const { nodes, wires, currentDepthPath } = useCanvasStore()

  const totalWords = getTotalWordCount()

  return (
    <footer className="h-6 flex items-center justify-between px-3 border-t border-border bg-bg-secondary text-[11px] text-text-muted shrink-0 select-none">
      <div className="flex items-center gap-3">
        <span>{t('stats.total')}: {formatNumber(totalWords)} {t('stats.chars')}</span>
        <span className="text-text-muted/50">|</span>
        <span>{t('canvas.nodes')}: {nodes.length}</span>
        <span>{t('canvas.wires')}: {wires.length}</span>
        {currentDepthPath.length > 0 && (
          <span className="text-accent">{t('canvas.depth')}: {currentDepthPath.length}</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {currentChapter && (
          <span className="text-text-muted/60 truncate max-w-[200px]">
            {currentChapter.title}
          </span>
        )}
        {focusMode && (
          <span className="text-accent text-[10px] uppercase tracking-wider font-medium">
            Focus
          </span>
        )}
        <span className="text-text-muted/40">v0.1.0</span>
      </div>
    </footer>
  )
}
