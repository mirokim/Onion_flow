import { useEffect, useRef, useCallback } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { generateId } from '@/lib/utils'
import { ImageIcon, Upload, X } from 'lucide-react'

interface ImageLoadBodyProps {
  data: Record<string, any>
  nodeId: string
  selected: boolean
}

export function ImageLoadBody({ data, nodeId, selected }: ImageLoadBodyProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const images = (data.images || []) as Array<{
    id: string; name: string; data: string; mimeType: string; addedAt: number
  }>

  const addImages = useCallback((newImages: typeof images) => {
    const existing = (useCanvasStore.getState().nodes.find(n => n.id === nodeId)?.data.images || []) as typeof images
    useCanvasStore.getState().updateNodeData(nodeId, {
      images: [...existing, ...newImages],
    })
  }, [nodeId])

  const removeImage = useCallback((imageId: string) => {
    const existing = (useCanvasStore.getState().nodes.find(n => n.id === nodeId)?.data.images || []) as typeof images
    useCanvasStore.getState().updateNodeData(nodeId, {
      images: existing.filter(img => img.id !== imageId),
    })
  }, [nodeId])

  const handleFileUpload = useCallback((files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1]
        addImages([{
          id: generateId(),
          name: file.name,
          data: base64,
          mimeType: file.type,
          addedAt: Date.now(),
        }])
      }
      reader.readAsDataURL(file)
    }
  }, [addImages])

  // Ctrl+V paste — active only when selected
  useEffect(() => {
    if (!selected) return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const blob = item.getAsFile()
          if (!blob) continue
          const reader = new FileReader()
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1]
            addImages([{
              id: generateId(),
              name: `paste-${Date.now()}.png`,
              data: base64,
              mimeType: blob.type || 'image/png',
              addedAt: Date.now(),
            }])
          }
          reader.readAsDataURL(blob)
        }
      }
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [selected, addImages])

  return (
    <div className="mt-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-text-muted flex items-center gap-1">
          <ImageIcon className="w-3 h-3" />
          {images.length}개 이미지
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="text-[10px] text-accent hover:text-accent/80 flex items-center gap-0.5"
        >
          <Upload className="w-2.5 h-2.5" /> 추가
        </button>
      </div>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-1">
          {images.slice(0, 6).map((img) => (
            <div key={img.id} className="relative group w-full aspect-square rounded overflow-hidden bg-bg-primary">
              <img
                src={`data:${img.mimeType};base64,${img.data}`}
                alt={img.name}
                className="w-full h-full object-cover"
                draggable={false}
              />
              <button
                onClick={(e) => { e.stopPropagation(); removeImage(img.id) }}
                onMouseDown={(e) => e.stopPropagation()}
                className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white rounded-bl opacity-0 group-hover:opacity-100 flex items-center justify-center transition"
              >
                <X className="w-2 h-2" />
              </button>
            </div>
          ))}
        </div>
      )}
      {images.length > 6 && (
        <div className="text-[9px] text-text-muted text-center mt-0.5">+{images.length - 6}개 더</div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { handleFileUpload(e.target.files); e.target.value = '' }}
      />

      {selected && images.length === 0 && (
        <div className="text-[9px] text-text-muted text-center mt-1 italic">
          Ctrl+V로 이미지 붙여넣기
        </div>
      )}
    </div>
  )
}
