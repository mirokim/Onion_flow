import { useEffect, useRef, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectStore } from '@/stores/projectStore'
import { Undo2, X } from 'lucide-react'

const TOAST_DURATION = 5000

export function UndoToast() {
  const { t } = useTranslation()
  const { deletedChapterStack, undoDeleteChapter } = useProjectStore()
  const [visible, setVisible] = useState(false)
  const [title, setTitle] = useState('')
  const [progress, setProgress] = useState(100)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const animRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const prevStackLenRef = useRef(0)

  useEffect(() => {
    useProjectStore.setState({ undoToastVisible: visible })
  }, [visible])

  useEffect(() => {
    if (deletedChapterStack.length > prevStackLenRef.current && deletedChapterStack.length > 0) {
      const entry = deletedChapterStack[0]
      setTitle(entry.chapter.title)
      setVisible(true)
      setProgress(100)
      startTimeRef.current = Date.now()

      if (timerRef.current) clearTimeout(timerRef.current)
      if (animRef.current) cancelAnimationFrame(animRef.current)

      const animate = () => {
        const elapsed = Date.now() - startTimeRef.current
        const remaining = Math.max(0, 100 - (elapsed / TOAST_DURATION) * 100)
        setProgress(remaining)
        if (remaining > 0) {
          animRef.current = requestAnimationFrame(animate)
        }
      }
      animRef.current = requestAnimationFrame(animate)

      timerRef.current = setTimeout(() => {
        setVisible(false)
        if (animRef.current) cancelAnimationFrame(animRef.current)
      }, TOAST_DURATION)
    }
    prevStackLenRef.current = deletedChapterStack.length
  }, [deletedChapterStack])

  const handleUndo = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setVisible(false)
    await undoDeleteChapter()
  }, [undoDeleteChapter])

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (animRef.current) cancelAnimationFrame(animRef.current)
    setVisible(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="relative bg-bg-surface border border-border rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 min-w-[280px] max-w-[420px] overflow-hidden">
        <div
          className="absolute bottom-0 left-0 h-0.5 bg-accent/60 transition-none"
          style={{ width: `${progress}%` }}
        />

        <span className="text-sm text-text-primary truncate flex-1">
          {t('undo.chapterDeleted', { title })}
        </span>

        <button
          onClick={handleUndo}
          className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent hover:text-accent-hover bg-accent/10 hover:bg-accent/20 rounded-md transition whitespace-nowrap"
        >
          <Undo2 className="w-3 h-3" />
          {t('undo.restore')}
        </button>

        <button
          onClick={handleDismiss}
          className="p-0.5 text-text-muted hover:text-text-primary transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  )
}
