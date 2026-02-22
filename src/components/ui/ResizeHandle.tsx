import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  side: 'left' | 'right'
  onResize: (delta: number) => void
  className?: string
}

export function ResizeHandle({ side, onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    startXRef.current = e.clientX
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current
      startXRef.current = e.clientX
      onResize(delta)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, onResize, side])

  return (
    <div
      onMouseDown={handleMouseDown}
      className={cn(
        'w-1 shrink-0 cursor-col-resize group relative z-10',
        'hover:bg-accent/30 active:bg-accent/50 transition-colors',
        isDragging && 'bg-accent/50',
        className,
      )}
    >
      <div className={cn(
        'absolute top-0 bottom-0 w-3 -translate-x-1/2 left-1/2',
      )} />
    </div>
  )
}
