import { useTranslation } from 'react-i18next'
import { useEditorStore } from '@/stores/editorStore'
import { useProjectStore } from '@/stores/projectStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { useSaveStatusStore } from '@/stores/saveStatusStore'
import { formatNumber } from '@/lib/utils'

function formatSaveTime(ts: number | null): string {
  if (!ts) return ''
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, '0')
  const m = d.getMinutes().toString().padStart(2, '0')
  const s = d.getSeconds().toString().padStart(2, '0')
  return `${h}:${m}:${s}`
}

function SaveStatusIndicator() {
  const status = useSaveStatusStore(s => s.status)
  const lastSavedAt = useSaveStatusStore(s => s.lastSavedAt)

  return (
    <>
      <span className="text-text-muted/50">|</span>
      {status === 'modified' && (
        <span className="text-yellow-500/80 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-yellow-500/80" />
          수정됨
        </span>
      )}
      {status === 'saving' && (
        <span className="text-blue-400/80 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
          저장 중...
        </span>
      )}
      {status === 'saved' && (
        <span className="text-green-500/80 flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500/80" />
          저장됨
        </span>
      )}
      {(status === 'idle' || status === 'modified') && lastSavedAt && (
        <span className="text-text-muted/50" title={new Date(lastSavedAt).toLocaleString()}>
          마지막 저장 {formatSaveTime(lastSavedAt)}
        </span>
      )}
    </>
  )
}

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
        <SaveStatusIndicator />
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
