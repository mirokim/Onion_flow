import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface ResizeHandleProps {
  onResize: (delta: number) => void
  className?: string
}

export function ResizeHandle({ onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false)
  const startXRef = useRef(0)
  const onResizeRef = useRef(onResize)

  // Keep the ref always up-to-date
  useEffect(() => {
    onResizeRef.current = onResize
  })

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
      onResizeRef.current(delta)
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
  }, [isDragging])

  return (
    <div className={cn('w-1 shrink-0 relative z-10', className)}>
      {/* Wider invisible hit area via negative insets — does not affect flex layout */}
      <div
        onMouseDown={handleMouseDown}
        className={cn(
          'absolute inset-y-0 -left-2 -right-2 cursor-col-resize group flex items-center justify-center',
        )}
      >
        <div className={cn(
          'w-px h-full transition-colors',
          isDragging ? 'bg-accent/60' : 'bg-border group-hover:bg-accent/50',
        )} />
      </div>
    </div>
  )
}
