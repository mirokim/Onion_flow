import { useState, useRef, useEffect, useCallback } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'

/**
 * IME-safe textarea for canvas nodes.
 * Uses local state to buffer input so Korean/CJK composition is not interrupted.
 * Flushes to the store on composition end and on debounced idle.
 */
export function NodeTextarea({ nodeId, field, value, placeholder, rows = 3, className }: {
  nodeId: string; field: string; value: string
  placeholder?: string; rows?: number; className?: string
}) {
  const [local, setLocal] = useState(value)
  const composingRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync from store when external value changes (e.g., undo/redo)
  useEffect(() => {
    if (!composingRef.current) setLocal(value)
  }, [value])

  const flush = useCallback((v: string) => {
    useCanvasStore.getState().updateNodeData(nodeId, { [field]: v })
  }, [nodeId, field])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.stopPropagation()
    const v = e.target.value
    setLocal(v)
    if (!composingRef.current) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => flush(v), 300)
    }
  }

  const handleCompositionStart = () => { composingRef.current = true }
  const handleCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    composingRef.current = false
    const v = (e.target as HTMLTextAreaElement).value
    setLocal(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => flush(v), 300)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return (
    <textarea
      value={local}
      onChange={handleChange}
      onCompositionStart={handleCompositionStart}
      onCompositionEnd={handleCompositionEnd}
      onBlur={() => { if (timerRef.current) clearTimeout(timerRef.current); flush(local) }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      placeholder={placeholder}
      rows={rows}
      className={className}
    />
  )
}
