/**
 * ExportPopup - Platform-specific export options.
 */
import { X, Download } from 'lucide-react'
import { useProjectStore } from '@/stores/projectStore'
import { PLATFORM_TEMPLATES } from '@/export/platformTemplates'
import { exportForMunpia } from '@/export/munpiaExport'
import { exportForSeries } from '@/export/seriesExport'
import { toast } from '@/components/common/Toast'

interface ExportPopupProps {
  onClose: () => void
}

export function ExportPopup({ onClose }: ExportPopupProps) {
  const chapters = useProjectStore(s => s.chapters)

  const handleExport = (templateId: string) => {
    const chapterCount = chapters.filter(ch => ch.type === 'chapter').length
    if (chapterCount === 0) {
      toast.warning('내보낼 챕터가 없습니다.')
      return
    }

    switch (templateId) {
      case 'munpia':
        exportForMunpia(chapters)
        toast.success('문피아 형식으로 내보냈습니다.')
        break
      case 'series':
        exportForSeries(chapters, 6000)
        toast.success('시리즈 형식으로 내보냈습니다.')
        break
      case 'kakaopage':
        exportForSeries(chapters, 5000)
        toast.success('카카오페이지 형식으로 내보냈습니다.')
        break
      case 'plain':
        exportForSeries(chapters, 0)
        toast.success('텍스트 파일로 내보냈습니다.')
        break
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-xl shadow-xl w-[400px]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold">내보내기</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-bg-tertiary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Template list */}
        <div className="p-4 space-y-2">
          {PLATFORM_TEMPLATES.map(template => (
            <button
              key={template.id}
              onClick={() => handleExport(template.id)}
              className="w-full text-left p-3 rounded-lg border border-[var(--color-border)] hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors"
            >
              <div className="text-sm font-medium">{template.name}</div>
              <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {template.description}
              </div>
              {template.maxCharsPerChapter > 0 && (
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                  최대 {template.maxCharsPerChapter.toLocaleString()}자/회
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
