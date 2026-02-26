/**
 * Unit tests for editorStore.
 * Tests: theme, language, uiScale, focusMode, tabs, panel widths,
 *        line numbers, emotion data, folded nodes.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './editorStore'

function resetStore() {
  useEditorStore.setState({
    theme: 'dark',
    language: 'ko',
    uiScale: 'm',
    focusMode: false,
    openTabs: ['canvas', 'editor', 'wiki'],
    panelGroups: [
      { id: 'test-canvas', tabs: ['canvas'], activeTab: 'canvas', width: 480 },
      { id: 'test-editor', tabs: ['editor'], activeTab: 'editor', width: 500 },
      { id: 'test-wiki', tabs: ['wiki'], activeTab: 'wiki', width: 600 },
    ],
    showLineNumbers: false,
    lineNumberOpacity: 0.4,
    emotionData: {},
    foldedNodesByChapter: {},
  })
}

describe('editorStore', () => {
  beforeEach(() => {
    resetStore()
  })

  // ── Default State ──

  describe('default state', () => {
    it('should have correct default values', () => {
      const state = useEditorStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.language).toBe('ko')
      expect(state.uiScale).toBe('m')
      expect(state.focusMode).toBe(false)
      expect(state.openTabs).toEqual(['canvas', 'editor', 'wiki'])
      expect(state.panelGroups[0].width).toBe(480)
      expect(state.panelGroups[2].width).toBe(600)
      expect(state.showLineNumbers).toBe(false)
      expect(state.lineNumberOpacity).toBe(0.4)
      expect(state.emotionData).toEqual({})
      expect(state.foldedNodesByChapter).toEqual({})
    })
  })

  // ── Theme ──

  describe('setTheme', () => {
    it('should set theme to light', () => {
      useEditorStore.getState().setTheme('light')
      expect(useEditorStore.getState().theme).toBe('light')
    })

    it('should set theme to black', () => {
      useEditorStore.getState().setTheme('black')
      expect(useEditorStore.getState().theme).toBe('black')
    })
  })

  // ── Language ──

  describe('setLanguage', () => {
    it('should set language to en', () => {
      useEditorStore.getState().setLanguage('en')
      expect(useEditorStore.getState().language).toBe('en')
    })
  })

  // ── UI Scale ──

  describe('setUiScale', () => {
    it('should set uiScale to each valid value', () => {
      const scales = ['xs', 's', 'm', 'l', 'xl'] as const
      for (const scale of scales) {
        useEditorStore.getState().setUiScale(scale)
        expect(useEditorStore.getState().uiScale).toBe(scale)
      }
    })
  })

  // ── Focus Mode ──

  describe('toggleFocusMode', () => {
    it('should toggle focusMode from false to true', () => {
      useEditorStore.getState().toggleFocusMode()
      expect(useEditorStore.getState().focusMode).toBe(true)
    })

    it('should toggle focusMode from true to false', () => {
      useEditorStore.getState().setFocusMode(true)
      useEditorStore.getState().toggleFocusMode()
      expect(useEditorStore.getState().focusMode).toBe(false)
    })
  })

  // ── Tabs ──

  describe('toggleTab', () => {
    it('should close an open tab', () => {
      useEditorStore.getState().toggleTab('wiki')
      expect(useEditorStore.getState().openTabs).toEqual(['canvas', 'editor'])
    })

    it('should open a closed tab by appending to end', () => {
      useEditorStore.getState().toggleTab('wiki')
      useEditorStore.getState().toggleTab('wiki')
      expect(useEditorStore.getState().openTabs).toEqual(['canvas', 'editor', 'wiki'])
    })

    it('should NOT close the last remaining tab', () => {
      useEditorStore.getState().toggleTab('canvas')
      useEditorStore.getState().toggleTab('editor')
      expect(useEditorStore.getState().openTabs).toEqual(['wiki'])

      useEditorStore.getState().toggleTab('wiki')
      expect(useEditorStore.getState().openTabs).toEqual(['wiki'])
    })

    it('should append reopened tab to end regardless of original position', () => {
      useEditorStore.getState().toggleTab('canvas')
      useEditorStore.getState().toggleTab('canvas')
      expect(useEditorStore.getState().openTabs).toEqual(['editor', 'wiki', 'canvas'])
    })
  })

  describe('reorderTabs', () => {
    it('should replace tab order with provided array', () => {
      useEditorStore.getState().reorderTabs(['wiki', 'canvas', 'editor'])
      expect(useEditorStore.getState().openTabs).toEqual(['wiki', 'canvas', 'editor'])
    })
  })

  // ── Panel Widths ──

  describe('panel widths', () => {
    it('should set width on a specific group', () => {
      useEditorStore.getState().setGroupWidth('test-canvas', 600)
      const group = useEditorStore.getState().panelGroups.find(g => g.id === 'test-canvas')
      expect(group?.width).toBe(600)
    })

    it('should clamp width to minimum', () => {
      useEditorStore.getState().setGroupWidth('test-canvas', 50)
      const group = useEditorStore.getState().panelGroups.find(g => g.id === 'test-canvas')
      expect(group?.width).toBe(200)
    })

    it('should clamp width to maximum', () => {
      useEditorStore.getState().setGroupWidth('test-canvas', 2000)
      const group = useEditorStore.getState().panelGroups.find(g => g.id === 'test-canvas')
      expect(group?.width).toBe(1200)
    })

    it('should allow wiki width up to global maximum (1200)', () => {
      useEditorStore.getState().setGroupWidth('test-wiki', 1200)
      const group = useEditorStore.getState().panelGroups.find(g => g.id === 'test-wiki')
      expect(group?.width).toBe(1200)
    })

    it('should clamp wiki width above global maximum', () => {
      useEditorStore.getState().setGroupWidth('test-wiki', 2000)
      const group = useEditorStore.getState().panelGroups.find(g => g.id === 'test-wiki')
      expect(group?.width).toBe(1200)
    })

    it('should clamp wiki width to global minimum (200)', () => {
      useEditorStore.getState().setGroupWidth('test-wiki', 50)
      const group = useEditorStore.getState().panelGroups.find(g => g.id === 'test-wiki')
      expect(group?.width).toBe(200)
    })
  })

  // ── Line Numbers ──

  describe('line numbers', () => {
    it('should toggle showLineNumbers', () => {
      useEditorStore.getState().setShowLineNumbers(true)
      expect(useEditorStore.getState().showLineNumbers).toBe(true)
    })

    it('should set lineNumberOpacity', () => {
      useEditorStore.getState().setLineNumberOpacity(0.8)
      expect(useEditorStore.getState().lineNumberOpacity).toBe(0.8)
    })
  })

  // ── Emotion Data ──

  describe('setEmotionData', () => {
    it('should set emotions for a character and chapter', () => {
      useEditorStore.getState().setEmotionData('char-1', 'ch-1', { joy: 0.8 })
      expect(useEditorStore.getState().emotionData['char-1']['ch-1']).toEqual({ joy: 0.8 })
    })

    it('should allow multiple chapters for same character', () => {
      useEditorStore.getState().setEmotionData('char-1', 'ch-1', { joy: 0.8 })
      useEditorStore.getState().setEmotionData('char-1', 'ch-2', { anger: 0.5 })

      const data = useEditorStore.getState().emotionData
      expect(data['char-1']['ch-1']).toEqual({ joy: 0.8 })
      expect(data['char-1']['ch-2']).toEqual({ anger: 0.5 })
    })

    it('should overwrite existing emotions for same character+chapter', () => {
      useEditorStore.getState().setEmotionData('char-1', 'ch-1', { joy: 0.8 })
      useEditorStore.getState().setEmotionData('char-1', 'ch-1', { anger: 1.0 })
      expect(useEditorStore.getState().emotionData['char-1']['ch-1']).toEqual({ anger: 1.0 })
    })

    it('should not affect other characters', () => {
      useEditorStore.getState().setEmotionData('char-1', 'ch-1', { joy: 0.8 })
      useEditorStore.getState().setEmotionData('char-2', 'ch-1', { sadness: 0.7 })
      expect(useEditorStore.getState().emotionData['char-1']['ch-1']).toEqual({ joy: 0.8 })
    })
  })

  // ── Folded Nodes ──

  describe('foldedNodesByChapter', () => {
    it('should set folded nodes for a chapter', () => {
      useEditorStore.getState().setFoldedNodesByChapter('ch-1', ['n1', 'n2'])
      expect(useEditorStore.getState().foldedNodesByChapter['ch-1']).toEqual(['n1', 'n2'])
    })

    it('should remove entries for given chapter IDs', () => {
      useEditorStore.getState().setFoldedNodesByChapter('ch-1', ['n1'])
      useEditorStore.getState().setFoldedNodesByChapter('ch-2', ['n2'])
      useEditorStore.getState().setFoldedNodesByChapter('ch-3', ['n3'])

      useEditorStore.getState().removeFoldedNodesByChapter(['ch-1', 'ch-3'])

      const folded = useEditorStore.getState().foldedNodesByChapter
      expect(folded).not.toHaveProperty('ch-1')
      expect(folded).not.toHaveProperty('ch-3')
      expect(folded['ch-2']).toEqual(['n2'])
    })

    it('should handle removing non-existent chapter IDs gracefully', () => {
      useEditorStore.getState().setFoldedNodesByChapter('ch-1', ['n1'])
      useEditorStore.getState().removeFoldedNodesByChapter(['ch-99'])
      expect(useEditorStore.getState().foldedNodesByChapter['ch-1']).toEqual(['n1'])
    })
  })
})
