/**
 * BaseNode — Universal renderer for all non-group canvas nodes.
 * Looks up the node definition from the registry and renders handles/header dynamically.
 * Shows execution output (ComfyUI-style) when available.
 */
import { memo, useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { getNodeDefinition } from '../index'
import { useCanvasStore, type NodeOutput } from '@/stores/canvasStore'
import { useWikiStore } from '@/stores/wikiStore'
import { useProjectStore } from '@/stores/projectStore'
import { cn } from '@/lib/utils'
import type { WikiCategory } from '@/types'
import type { WikiEntry } from '@/types'
import { ImageLoadBody } from './ImageLoadBody'
import { DocumentLoadBody } from './DocumentLoadBody'
import { CharacterNodeBody } from './CharacterNodeBody'
import { SwitchNodeBody } from './SwitchNodeBody'
import { PLOT_GENRE_OPTIONS, PLOT_STRUCTURE_OPTIONS, GENRE_GROUPS } from '../index'

interface BaseNodeData {
  label?: string
  nodeType: string
  nodeId?: string
  [key: string]: any
}

/**
 * IME-safe textarea for canvas nodes.
 * Uses local state to buffer input so Korean/CJK composition is not interrupted.
 * Flushes to the store on composition end and on debounced idle.
 */
function NodeTextarea({ nodeId, field, value, placeholder, rows = 3, className }: {
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
    // During composition, don't flush to store
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

  // Flush on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      // Use ref's latest local value
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

/** Map node types to their wiki category for wiki-linked nodes */
const WIKI_CATEGORY_MAP: Record<string, WikiCategory | 'all'> = {
  character: 'character',
  memory: 'character_memory',
  motivation: 'character_motivation',
  event: 'event',
  wiki: 'all',
}

// ── Style Transfer Node Body ────────────────────────────────────────────

type StyleSourceTab = 'wiki' | 'url' | 'document'

function StyleTransferNodeBody({ nodeId, data }: { nodeId: string; data: Record<string, any> }) {
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
        if (!fileResult) return // 사용자 취소
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

// ── Virtual Reader Node Body ────────────────────────────────────────────

const DEFAULT_READER_PERSONAS = ['사이다패스', '설정덕후', '감성독자', '비평가', '라이트유저']

function VirtualReaderBody({ data, nodeId }: { data: Record<string, any>; nodeId: string }) {
  const selectedPersonas = (data.selectedPersonas || data.personas || DEFAULT_READER_PERSONAS.slice(0, 3)) as string[]

  const togglePersona = (persona: string) => {
    const current = new Set(selectedPersonas)
    if (current.has(persona)) {
      current.delete(persona)
    } else {
      current.add(persona)
    }
    useCanvasStore.getState().updateNodeData(nodeId, { selectedPersonas: [...current] })
  }

  return (
    <div className="mt-1.5">
      <label className="block text-[9px] text-text-muted mb-1">독자 페르소나</label>
      <div className="flex flex-wrap gap-1">
        {DEFAULT_READER_PERSONAS.map(persona => {
          const isSelected = selectedPersonas.includes(persona)
          return (
            <button
              key={persona}
              onClick={(e) => { e.stopPropagation(); togglePersona(persona) }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className={cn(
                'px-1.5 py-0.5 rounded text-[9px] transition-all border',
                isSelected
                  ? 'bg-accent/20 text-accent border-accent/30 font-semibold'
                  : 'bg-bg-primary text-text-muted border-border hover:border-accent/30',
              )}
            >
              {persona}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function BaseNodeComponent({ data, selected }: NodeProps & { data: BaseNodeData }) {
  const def = getNodeDefinition(data.nodeType)
  if (!def) return null

  const inputs = def.inputs
  const outputs = def.outputs

  // Read execution output from store
  const nodeOutput = useCanvasStore(s =>
    data.nodeId ? s.nodeOutputs[data.nodeId] : undefined,
  )

  // Wiki entry selector for wiki-linked nodes
  const wikiCategory = WIKI_CATEGORY_MAP[data.nodeType]
  const allWikiEntries = useWikiStore(s => s.entries)
  const wikiEntries = useMemo(
    () => {
      if (!wikiCategory) return [] as WikiEntry[]
      if (wikiCategory === 'all') return allWikiEntries
      return allWikiEntries.filter(e => e.category === wikiCategory)
    },
    [allWikiEntries, wikiCategory],
  )
  const selectedWikiEntry = useMemo(
    () => data.wikiEntryId ? allWikiEntries.find(e => e.id === data.wikiEntryId) : undefined,
    [allWikiEntries, data.wikiEntryId],
  )

  return (
    <div
      className={cn(
        'canvas-node relative overflow-visible rounded-lg shadow-md border-2 min-w-[160px]',
        data.nodeType === 'character' ? 'max-w-[320px]' : 'max-w-[280px]',
        'bg-bg-surface text-text-primary',
        selected ? 'border-accent shadow-accent/20' : 'border-border',
        nodeOutput?.status === 'running' && 'border-yellow-500/60',
        nodeOutput?.status === 'error' && 'border-red-500/60',
        nodeOutput?.status === 'completed' && 'border-green-500/40',
      )}
    >
      {/* Header */}
      <div
        className="canvas-node-header px-3 py-1.5 rounded-t-md text-xs font-semibold text-white truncate flex items-center gap-1.5"
        style={{ backgroundColor: def.color }}
      >
        {/* Status indicator */}
        {nodeOutput?.status === 'running' && (
          <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse shrink-0" />
        )}
        {nodeOutput?.status === 'queued' && (
          <div className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
        )}
        {nodeOutput?.status === 'completed' && (
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        )}
        {nodeOutput?.status === 'error' && (
          <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
        )}
        <span className="truncate">{data.label || def.labelKo}</span>
      </div>

      {/* Body */}
      <div className="canvas-node-body px-3 py-2 text-xs text-text-secondary">
        <span className="text-text-muted/60 uppercase tracking-wider text-[10px]">
          {def.category}
        </span>

        {/* Wiki-linked nodes: entry selector + read-only content */}
        {wikiCategory && (
          <div className="mt-1.5">
            <select
              value={data.wikiEntryId || ''}
              onChange={(e) => {
                e.stopPropagation()
                const value = e.target.value || null
                if (data.nodeId) {
                  useCanvasStore.getState().updateNodeData(data.nodeId, { wikiEntryId: value })
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <option value="">위키 항목 선택...</option>
              {wikiEntries.map(entry => (
                <option key={entry.id} value={entry.id}>
                  {entry.title || 'Untitled'}
                </option>
              ))}
            </select>
            {selectedWikiEntry?.content && (
              <p className="mt-1 text-[10px] text-text-muted leading-relaxed bg-bg-primary/50 rounded px-1.5 py-1 max-h-[60px] overflow-y-auto">
                {selectedWikiEntry.content.length > 100
                  ? selectedWikiEntry.content.slice(0, 100) + '...'
                  : selectedWikiEntry.content}
              </p>
            )}
          </div>
        )}

        {/* Character: wiki-linked info preview */}
        {data.nodeType === 'character' && data.nodeId && (
          <CharacterNodeBody data={data} nodeId={data.nodeId} />
        )}

        {/* Switch: input selector */}
        {data.nodeType === 'switch' && data.nodeId && (
          <SwitchNodeBody data={data} nodeId={data.nodeId} />
        )}

        {/* Plot Context: unified genre + structure + wiki entry with 2-line preview */}
        {data.nodeType === 'plot_context' && (
          <div className="mt-1.5 space-y-1.5">
            {/* Genre dropdown */}
            <div>
              <label className="block text-[9px] text-text-muted mb-0.5">플롯 장르</label>
              <select
                value={data.selectedGenre || ''}
                onChange={(e) => {
                  e.stopPropagation()
                  if (data.nodeId) {
                    useCanvasStore.getState().updateNodeData(data.nodeId, { selectedGenre: e.target.value || null })
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="">장르 선택...</option>
                {GENRE_GROUPS.map(grp => (
                  <optgroup key={grp.key} label={grp.label}>
                    {PLOT_GENRE_OPTIONS.filter(o => o.group === grp.key).map(opt => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {data.selectedGenre && (() => {
                const sel = PLOT_GENRE_OPTIONS.find(o => o.id === data.selectedGenre)
                return sel ? (
                  <p className="mt-0.5 text-[9px] text-text-muted leading-relaxed bg-bg-primary/50 rounded px-1.5 py-0.5">{sel.description}</p>
                ) : null
              })()}
            </div>

            {/* Structure dropdown */}
            <div>
              <label className="block text-[9px] text-text-muted mb-0.5">플롯 형식</label>
              <select
                value={data.selectedStructure || ''}
                onChange={(e) => {
                  e.stopPropagation()
                  if (data.nodeId) {
                    useCanvasStore.getState().updateNodeData(data.nodeId, { selectedStructure: e.target.value || null })
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="">형식 선택...</option>
                {PLOT_STRUCTURE_OPTIONS.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.label}</option>
                ))}
              </select>
              {data.selectedStructure && (() => {
                const sel = PLOT_STRUCTURE_OPTIONS.find(o => o.id === data.selectedStructure)
                return sel ? (
                  <p className="mt-0.5 text-[9px] text-text-muted leading-relaxed bg-bg-primary/50 rounded px-1.5 py-0.5">{sel.description}</p>
                ) : null
              })()}
            </div>

            {/* Wiki entry selector with 2-line preview */}
            <div>
              <label className="block text-[9px] text-text-muted mb-0.5">플롯</label>
              <select
                value={data.wikiEntryId || ''}
                onChange={(e) => {
                  e.stopPropagation()
                  if (data.nodeId) {
                    useCanvasStore.getState().updateNodeData(data.nodeId, { wikiEntryId: e.target.value || null })
                  }
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="">플롯 위키 항목...</option>
                {allWikiEntries.filter(e => e.category === 'plot').map(entry => (
                  <option key={entry.id} value={entry.id}>{entry.title || 'Untitled'}</option>
                ))}
              </select>
              {data.wikiEntryId && (() => {
                const plotEntry = allWikiEntries.find(e => e.id === data.wikiEntryId)
                if (!plotEntry?.content) return null
                const lines = plotEntry.content.split('\n').filter(l => l.trim()).slice(0, 2)
                const preview = lines.join('\n')
                return (
                  <p className="mt-0.5 text-[9px] text-text-muted leading-relaxed bg-bg-primary/50 rounded px-1.5 py-1 whitespace-pre-line line-clamp-2">
                    {preview.length > 120 ? preview.slice(0, 120) + '...' : preview}
                  </p>
                )
              })()}
            </div>
          </div>
        )}

        {/* Image Load: thumbnail grid + upload */}
        {data.nodeType === 'image_load' && data.nodeId && (
          <ImageLoadBody data={data} nodeId={data.nodeId} selected={!!selected} />
        )}

        {/* Document Load: document list + upload */}
        {data.nodeType === 'document_load' && data.nodeId && (
          <DocumentLoadBody data={data} nodeId={data.nodeId} selected={!!selected} />
        )}

        {/* POV Control: perspective type + focus character */}
        {data.nodeType === 'pov' && data.nodeId && (
          <div className="mt-1.5 space-y-1.5">
            <div>
              <label className="block text-[9px] text-text-muted mb-0.5">시점</label>
              <select
                value={data.povType || 'third_limited'}
                onChange={(e) => {
                  e.stopPropagation()
                  useCanvasStore.getState().updateNodeData(data.nodeId!, { povType: e.target.value })
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="first">1인칭</option>
                <option value="third_limited">3인칭 제한</option>
                <option value="third_omniscient">3인칭 전지적</option>
                <option value="second">2인칭</option>
              </select>
            </div>
            <div>
              <label className="block text-[9px] text-text-muted mb-0.5">초점 캐릭터 (선택)</label>
              <select
                value={data.characterId || ''}
                onChange={(e) => {
                  e.stopPropagation()
                  useCanvasStore.getState().updateNodeData(data.nodeId!, { characterId: e.target.value || null })
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="">없음</option>
                {allWikiEntries.filter(e => e.category === 'character').map(entry => (
                  <option key={entry.id} value={entry.id}>{entry.title || 'Untitled'}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Pacing: tension slider + speed */}
        {data.nodeType === 'pacing' && data.nodeId && (
          <div className="mt-1.5 space-y-1.5">
            <div>
              <label className="block text-[9px] text-text-muted mb-0.5">
                긴장감: <span className="text-text-primary font-semibold">{data.tension ?? 5}/10</span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={data.tension ?? 5}
                onChange={(e) => {
                  e.stopPropagation()
                  useCanvasStore.getState().updateNodeData(data.nodeId!, { tension: Number(e.target.value) })
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full h-1.5 accent-accent cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-muted mb-0.5">호흡</label>
              <select
                value={data.speed || 'normal'}
                onChange={(e) => {
                  e.stopPropagation()
                  useCanvasStore.getState().updateNodeData(data.nodeId!, { speed: e.target.value })
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
              >
                <option value="slow">느림 — 묘사 중심, 여운</option>
                <option value="normal">보통 — 균형 잡힌 서술</option>
                <option value="fast">빠름 — 짧은 문장, 긴박감</option>
              </select>
            </div>
          </div>
        )}

        {/* Style Transfer: AI 문체 분석 + MD 저장/불러오기 */}
        {data.nodeType === 'style_transfer' && data.nodeId && (
          <StyleTransferNodeBody nodeId={data.nodeId} data={data} />
        )}

        {/* Storyteller: Provider dropdown + prompt */}
        {data.nodeType === 'storyteller' && (
          <div className="mt-1.5 space-y-1">
            <select
              value={data.provider || ''}
              onChange={(e) => {
                e.stopPropagation()
                const value = e.target.value || null
                if (data.nodeId) {
                  useCanvasStore.getState().updateNodeData(data.nodeId, { provider: value })
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full bg-bg-primary border border-border rounded px-1.5 py-0.5 text-[10px] text-text-primary outline-none focus:border-accent cursor-pointer"
            >
              <option value="">기본 (글로벌 설정)</option>
              <option value="anthropic">Claude</option>
              <option value="gemini">Gemini</option>
              <option value="grok">Grok</option>
              <option value="openai">GPT</option>
            </select>
            {data.nodeId && (
              <NodeTextarea
                nodeId={data.nodeId}
                field="prompt"
                value={data.prompt || ''}
                placeholder="추가 요구사항 입력..."
                rows={3}
                className="w-full bg-bg-primary border border-border rounded px-1.5 py-1 text-[10px] text-text-primary outline-none focus:border-accent resize-y min-h-[40px] max-h-[120px] leading-relaxed placeholder:text-text-muted/50"
              />
            )}
          </div>
        )}

        {/* Summarizer: max tokens control */}
        {data.nodeType === 'summarizer' && data.nodeId && (
          <div className="mt-1.5">
            <label className="block text-[9px] text-text-muted mb-0.5">
              최대 토큰: <span className="text-text-primary font-semibold">{data.maxTokens ?? 500}</span>
            </label>
            <input
              type="range"
              min={100}
              max={2000}
              step={100}
              value={data.maxTokens ?? 500}
              onChange={(e) => {
                e.stopPropagation()
                useCanvasStore.getState().updateNodeData(data.nodeId!, { maxTokens: Number(e.target.value) })
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full h-1.5 accent-accent cursor-pointer"
            />
          </div>
        )}

        {/* Tikitaka: topic + turns */}
        {data.nodeType === 'tikitaka' && data.nodeId && (
          <div className="mt-1.5 space-y-1.5">
            <div>
              <label className="block text-[9px] text-text-muted mb-0.5">대화 주제</label>
              <NodeTextarea
                nodeId={data.nodeId}
                field="topic"
                value={data.topic || ''}
                placeholder="캐릭터들이 대화할 주제..."
                rows={2}
                className="w-full bg-bg-primary border border-border rounded px-1.5 py-1 text-[10px] text-text-primary outline-none focus:border-accent resize-y min-h-[30px] max-h-[80px] leading-relaxed placeholder:text-text-muted/50"
              />
            </div>
            <div>
              <label className="block text-[9px] text-text-muted mb-0.5">
                대화 턴 수: <span className="text-text-primary font-semibold">{data.turns ?? 10}</span>
              </label>
              <input
                type="range"
                min={2}
                max={30}
                step={1}
                value={data.turns ?? 10}
                onChange={(e) => {
                  e.stopPropagation()
                  useCanvasStore.getState().updateNodeData(data.nodeId!, { turns: Number(e.target.value) })
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="w-full h-1.5 accent-accent cursor-pointer"
              />
            </div>
            <p className="text-[9px] text-text-muted/60">
              캐릭터 노드를 연결하면 자동으로 캐릭터가 추가됩니다
            </p>
          </div>
        )}

        {/* Cliffhanger: count control */}
        {data.nodeType === 'cliffhanger' && data.nodeId && (
          <div className="mt-1.5">
            <label className="block text-[9px] text-text-muted mb-0.5">
              제안 수: <span className="text-text-primary font-semibold">{data.count ?? 3}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={data.count ?? 3}
              onChange={(e) => {
                e.stopPropagation()
                useCanvasStore.getState().updateNodeData(data.nodeId!, { count: Number(e.target.value) })
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full h-1.5 accent-accent cursor-pointer"
            />
          </div>
        )}

        {/* Virtual Reader: persona selection */}
        {data.nodeType === 'virtual_reader' && data.nodeId && (
          <VirtualReaderBody data={data} nodeId={data.nodeId} />
        )}

        {/* What-If: scene input */}
        {data.nodeType === 'what_if' && data.nodeId && (
          <div className="mt-1.5">
            <label className="block text-[9px] text-text-muted mb-0.5">분기 장면 (선택)</label>
            <NodeTextarea
              nodeId={data.nodeId}
              field="scene"
              value={data.scene || ''}
              placeholder="비워두면 입력 데이터를 사용합니다..."
              rows={2}
              className="w-full bg-bg-primary border border-border rounded px-1.5 py-1 text-[10px] text-text-primary outline-none focus:border-accent resize-y min-h-[30px] max-h-[80px] leading-relaxed placeholder:text-text-muted/50"
            />
          </div>
        )}

        {/* Show Don't Tell: input text */}
        {data.nodeType === 'show_dont_tell' && data.nodeId && (
          <div className="mt-1.5">
            <label className="block text-[9px] text-text-muted mb-0.5">변환할 텍스트 (선택)</label>
            <NodeTextarea
              nodeId={data.nodeId}
              field="inputText"
              value={data.inputText || ''}
              placeholder="비워두면 입력 데이터를 사용합니다..."
              rows={2}
              className="w-full bg-bg-primary border border-border rounded px-1.5 py-1 text-[10px] text-text-primary outline-none focus:border-accent resize-y min-h-[30px] max-h-[80px] leading-relaxed placeholder:text-text-muted/50"
            />
          </div>
        )}
      </div>

      {/* Execution Output (storyteller hides completed text — result goes to editor) */}
      {nodeOutput && nodeOutput.status !== 'idle' && nodeOutput.status !== 'queued' && (
        <div className="border-t border-border">
          {nodeOutput.status === 'running' && (
            <div className="px-3 py-2 text-[10px] text-yellow-500 flex items-center gap-1.5">
              <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              실행 중...
            </div>
          )}

          {nodeOutput.status === 'completed' && data.nodeType !== 'storyteller' && nodeOutput.content && (
            <div className="px-3 py-2 max-h-[100px] overflow-y-auto">
              <p className="text-[10px] text-text-secondary whitespace-pre-wrap break-words leading-relaxed">
                {nodeOutput.content.length > 300
                  ? nodeOutput.content.slice(0, 300) + '...'
                  : nodeOutput.content}
              </p>
            </div>
          )}

          {nodeOutput.status === 'completed' && data.nodeType === 'storyteller' && (
            <div className="px-3 py-1.5 text-[10px] text-green-400 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
              생성 완료
            </div>
          )}

          {nodeOutput.status === 'error' && (
            <div className="px-3 py-2">
              <p className="text-[10px] text-red-400 break-words">
                {nodeOutput.error || '실행 중 오류가 발생했습니다.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Input Handles */}
      {inputs.map((input, i) => (
        <Handle
          key={input.id}
          type="target"
          position={Position.Left}
          id={input.id}
          className="!w-3 !h-3 !bg-text-muted !border-2 !border-bg-surface hover:!bg-accent hover:!scale-150 !transition-all !duration-150"
          style={{ top: `${((i + 1) / (inputs.length + 1)) * 100}%` }}
        />
      ))}

      {/* Output Handles */}
      {outputs.map((output, i) => (
        <Handle
          key={output.id}
          type="source"
          position={Position.Right}
          id={output.id}
          className="!w-3 !h-3 !bg-accent !border-2 !border-bg-surface hover:!scale-150 !transition-all !duration-150"
          style={{ top: `${((i + 1) / (outputs.length + 1)) * 100}%` }}
        />
      ))}
    </div>
  )
}

export const BaseNode = memo(BaseNodeComponent)
