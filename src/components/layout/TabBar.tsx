/**
 * TabBar - Obsidian-style vertical sidebar for toggling panels on/off.
 * Open tabs appear as active icons. Closed tabs appear below a divider as inactive icons.
 * Panel reordering is done by dragging each panel's header/tab bar.
 *
 * Responsive sizing: ResizeObserver watches the container height and scales
 * button/icon sizes proportionally so all tabs are always visible without overflow.
 *
 * Note: 'wiki' is no longer shown here — wiki entries are accessible via OpenFilesPanel.
 */
import { useRef, useEffect, useState } from 'react'
import { LayoutGrid, FileText, MessageSquare } from 'lucide-react'
import { useEditorStore, type PanelTab } from '@/stores/editorStore'
import { cn } from '@/lib/utils'

const ALL_TABS: { key: PanelTab; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'canvas', label: 'Story Flow', icon: LayoutGrid },
  { key: 'editor', label: 'Editor', icon: FileText },
  { key: 'ai', label: 'AI', icon: MessageSquare },
]

/** Button size bounds in px */
const BTN_MAX = 32 // w-8 h-8 (default)
const BTN_MIN = 20 // minimum — never go smaller

/** Vertical padding (py-2 = 8px×2) */
const PADDING_V = 16
/** Divider area: h-px + my-1 top + my-1 bottom ≈ 9px */
const DIVIDER_H = 9
/** gap-0.5 = 2px between buttons */
const GAP = 2

function calcBtnSize(containerH: number, totalTabs: number): number {
  const available = containerH - PADDING_V - DIVIDER_H
  const size = Math.floor((available - (totalTabs - 1) * GAP) / totalTabs)
  return Math.min(BTN_MAX, Math.max(BTN_MIN, size))
}

export function TabBar() {
  const { openTabs, toggleTab } = useEditorStore()
  const containerRef = useRef<HTMLDivElement>(null)
  const [btnSize, setBtnSize] = useState(BTN_MAX)

  // Observe container height changes and scale buttons proportionally
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setBtnSize(calcBtnSize(entry.contentRect.height, ALL_TABS.length))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Icon is ~14px smaller than button for a lighter, outline-style look
  const iconSize = Math.max(12, btnSize - 14)

  const openTabDefs = ALL_TABS.filter(t => openTabs.includes(t.key))
  const closedTabDefs = ALL_TABS.filter(t => !openTabs.includes(t.key))

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center w-10 bg-bg-secondary border-r border-border py-2 shrink-0 select-none"
    >
      {/* Open tabs (click to close) */}
      <div className="flex flex-col items-center gap-0.5 w-full px-1">
        {openTabDefs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => toggleTab(key)}
            style={{ width: btnSize, height: btnSize }}
            className={cn(
              'flex items-center justify-center rounded transition-all',
              'bg-bg-hover text-text-primary border border-border',
            )}
            title={label}
          >
            <Icon style={{ width: iconSize, height: iconSize }} strokeWidth={1.5} />
          </button>
        ))}
      </div>

      {/* Divider between open and closed tabs */}
      {closedTabDefs.length > 0 && (
        <>
          <div className="w-5 h-px bg-border my-1" />

          {/* Closed tabs (click to open) */}
          <div className="flex flex-col items-center gap-0.5 w-full px-1">
            {closedTabDefs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => toggleTab(key)}
                style={{ width: btnSize, height: btnSize }}
                className="flex items-center justify-center rounded transition-all text-text-muted hover:text-text-secondary hover:bg-bg-hover border border-transparent"
                title={label}
              >
                <Icon style={{ width: iconSize, height: iconSize }} strokeWidth={1.5} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
