/**
 * MultiTabCanvas — Obsidian-style multi-tab wrapper around NodeCanvas.
 * Shows a tab bar at the top. Each tab represents a different canvas view/depth.
 */
import { useEditorStore } from '@/stores/editorStore'
import { useCanvasStore } from '@/stores/canvasStore'
import { PanelTabBar, type PanelDragHandlers } from '@/components/layout/PanelTabBar'
import { DepthBreadcrumb } from '@/components/layout/DepthBreadcrumb'
import { NodeCanvas } from './NodeCanvas'

interface MultiTabCanvasProps {
  panelDragHandlers?: PanelDragHandlers
}

export function MultiTabCanvas({ panelDragHandlers }: MultiTabCanvasProps) {
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
    openCanvasTab(null, 'New Story Flow')
  }

  return (
    <div className="flex flex-col h-full min-h-0">
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
      />
      <DepthBreadcrumb />
      <div className="flex-1 relative overflow-hidden min-h-0">
        <NodeCanvas />
      </div>
    </div>
  )
}
