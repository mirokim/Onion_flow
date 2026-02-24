/**
 * MultiTabCanvas — Obsidian-style multi-tab wrapper around NodeCanvas.
 * Shows a tab bar at the top. Each tab represents a different canvas view/depth.
 */
import { useEditorStore } from '@/stores/editorStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { generateId } from '@/lib/utils'
import { PanelTabBar, type PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { DepthBreadcrumb } from '@/components/layout/DepthBreadcrumb'
import { NodeCanvas } from './NodeCanvas'

interface MultiTabCanvasProps {
  panelDragHandlers?: PanelDragHandlers
  isGrouped?: boolean
}

export function MultiTabCanvas({ panelDragHandlers, isGrouped }: MultiTabCanvasProps) {
  const canvasTabs = useEditorStore(s => s.canvasTabs)
  const activeCanvasTabId = useEditorStore(s => s.activeCanvasTabId)
  const closeCanvasTab = useEditorStore(s => s.closeCanvasTab)
  const setActiveCanvasTab = useEditorStore(s => s.setActiveCanvasTab)
  const openCanvasTab = useEditorStore(s => s.openCanvasTab)
  const reorderCanvasTabs = useEditorStore(s => s.reorderCanvasTabs)
  const toggleCanvasTabPin = useEditorStore(s => s.toggleCanvasTabPin)

  const warpToDepth = useCanvasStore(s => s.warpToDepth)

  const handleSelectTab = (tabId: string) => {
    setActiveCanvasTab(tabId)
    const tab = canvasTabs.find(t => t.id === tabId)
    if (tab) {
      // If root tab, warp to depth 0 (root)
      if (tab.targetId === null) {
        warpToDepth(0)
      }
    }
  }

  const handleAddTab = () => {
    // Use a unique ID so each + click creates a new tab (instead of focusing the existing root)
    openCanvasTab(generateId(), `Canvas ${canvasTabs.length + 1}`)
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {!isGrouped && (
        <PanelTabBar
          tabs={canvasTabs}
          activeTabId={activeCanvasTabId}
          onSelect={handleSelectTab}
          onClose={closeCanvasTab}
          onAdd={handleAddTab}
          onReorder={reorderCanvasTabs}
          onTogglePin={toggleCanvasTabPin}
          canClose
          panelDragHandlers={panelDragHandlers}
          panelType="canvas"
          onRenameTab={(tabId) => {
            const tab = canvasTabs.find(t => t.id === tabId)
            if (tab) {
              const newLabel = prompt('탭 이름변경', tab.label)
              if (newLabel && newLabel.trim()) {
                useEditorStore.setState(s => ({
                  canvasTabs: s.canvasTabs.map(t => t.id === tabId ? { ...t, label: newLabel.trim() } : t),
                }))
              }
            }
          }}
          onDuplicateTab={() => {
            useEditorStore.getState().splitTabToNewGroup('canvas')
          }}
        />
      )}
      <DepthBreadcrumb />
      <div className="flex-1 relative overflow-hidden min-h-0">
        <NodeCanvas />
      </div>
    </div>
  )
}
