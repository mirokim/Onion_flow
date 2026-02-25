import { useState } from 'react'
import { useCanvasStore } from '@/stores/canvasStore'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import { NodeTextarea } from './NodeTextarea'
import type { NodeBodyProps } from '../plugin'

type StyleSourceTab = 'wiki' | 'url' | 'document'

export function StyleTransferNodeBody({ nodeId, data }: NodeBodyProps) {
  const [tab, setTab] = useState<StyleSourceTab>('wiki')
  const [urlInput, setUrlInput] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handleAnalyze = async () => {
    setIsAnalyzing(true)
    setError(null)
    try {
      let result = ''
      if (tab === 'wiki') {
        const { analyzeStyleFromWiki } = await import('@/ai/styleAnalyzer')
        const projectId = useProjectStore.getState().currentProject?.id
        if (!projectId) throw new Error('열린 프로젝트가 없습니다.')
        result = await analyzeStyleFromWiki(projectId)
      } else if (tab === 'url') {
        if (!urlInput.trim()) throw new Error('URL을 입력해주세요.')
        const { analyzeStyleFromUrl } = await import('@/ai/styleAnalyzer')
        result = await analyzeStyleFromUrl(urlInput.trim())
      } else {
        const api = (window as any).electronAPI
        if (!api?.openTextFile) throw new Error('파일 열기가 지원되지 않는 환경입니다.')
        const fileResult = await api.openTextFile()
        if (!fileResult) return
        if (!fileResult.success) throw new Error(fileResult.error)
        const { analyzeStyleFromText } = await import('@/ai/styleAnalyzer')
        result = await analyzeStyleFromText(fileResult.data)
      }
      useCanvasStore.getState().updateNodeData(nodeId, { sampleText: result })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleSaveMd = async () => {
    const content = data.sampleText || ''
    if (!content.trim()) return
    const folderPath = useProjectStore.getState().currentProject?.folderPath
    if (folderPath) {
      const api = (window as any).electronAPI
      await api?.writeProjectFile(folderPath, 'my_style.md', content)
    } else {
      const blob = new Blob([content], { type: 'text/markdown' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'my_style.md'; a.click()
      URL.revokeObjectURL(url)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleLoadMd = async () => {
    const folderPath = useProjectStore.getState().currentProject?.folderPath
    if (!folderPath) { setError('프로젝트 폴더가 설정되어 있지 않습니다.'); return }
    const api = (window as any).electronAPI
    const result = await api?.readProjectFile(folderPath, 'my_style.md')
    if (result?.success) {
      useCanvasStore.getState().updateNodeData(nodeId, { sampleText: result.data })
    } else {
      setError('my_style.md 파일을 찾을 수 없습니다.')
    }
  }

  const tabLabels: Record<StyleSourceTab, string> = { wiki: '위키', url: 'URL', document: '문서' }

  return (
    <div className="mt-1.5 space-y-1.5">
      {/* 소스 탭 */}
      <div className="flex gap-0.5 bg-bg-primary rounded p-0.5">
        {(['wiki', 'url', 'document'] as StyleSourceTab[]).map(t => (
          <button
            key={t}
            onMouseDown={e => e.stopPropagation()}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); setTab(t); setError(null) }}
            className={cn(
              'flex-1 text-[9px] px-1 py-0.5 rounded transition-colors',
              tab === t ? 'bg-accent text-white' : 'text-text-muted hover:text-text-primary'
            )}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* 탭별 안내 / 입력 */}
      {tab === 'wiki' && (
        <p className="text-[9px] text-text-muted leading-relaxed">
          현재 프로젝트의 위키 항목 전체를 AI로 분석합니다.
        </p>
      )}
      {tab === 'url' && (
        <input
          type="url"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          onPointerDown={e => e.stopPropagation()}
          placeholder="https://blog.example.com/post"
          className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent placeholder:text-text-muted/50"
        />
      )}
      {tab === 'document' && (
        <p className="text-[9px] text-text-muted leading-relaxed">
          txt 또는 md 파일을 선택하면 내용을 AI로 분석합니다.
        </p>
      )}

      {/* 분석 버튼 */}
      <button
        onClick={e => { e.stopPropagation(); handleAnalyze() }}
        onMouseDown={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        disabled={isAnalyzing || (tab === 'url' && !urlInput.trim())}
        className="w-full text-[9px] py-1 rounded bg-accent/20 hover:bg-accent/30 text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {isAnalyzing ? '분석 중...' : `${tabLabels[tab]}에서 문체 분석`}
      </button>

      {/* 에러 */}
      {error && (
        <p className="text-[9px] text-red-400 leading-relaxed break-words">{error}</p>
      )}

      {/* 참고 작가 */}
      <div>
        <label className="block text-[9px] text-text-muted mb-0.5">참고 작가</label>
        <NodeTextarea
          nodeId={nodeId}
          field="authorName"
          value={data.authorName || ''}
          placeholder="예: 한강, 무라카미 하루키..."
          rows={1}
          className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent resize-none leading-relaxed placeholder:text-text-muted/50"
        />
      </div>

      {/* 문체 샘플 + MD 저장/불러오기 */}
      <div>
        <div className="flex justify-between items-center mb-0.5">
          <label className="text-[9px] text-text-muted">문체 샘플</label>
          <div className="flex gap-1.5">
            <button
              onClick={e => { e.stopPropagation(); handleSaveMd() }}
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              title="my_style.md 저장"
              className="text-[9px] text-text-muted hover:text-text-primary transition-colors"
            >
              {saved ? '✓' : '💾'}
            </button>
            <button
              onClick={e => { e.stopPropagation(); handleLoadMd() }}
              onMouseDown={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
              title="my_style.md 불러오기"
              className="text-[9px] text-text-muted hover:text-text-primary transition-colors"
            >
              📂
            </button>
          </div>
        </div>
        <NodeTextarea
          nodeId={nodeId}
          field="sampleText"
          value={data.sampleText || ''}
          placeholder="학습시킬 문체 샘플 텍스트를 붙여넣기..."
          rows={4}
          className="w-full bg-bg-primary border border-border rounded px-1.5 py-1 text-[10px] text-text-primary outline-none focus:border-accent resize-y min-h-[60px] max-h-[160px] leading-relaxed placeholder:text-text-muted/50"
        />
      </div>
    </div>
  )
}
