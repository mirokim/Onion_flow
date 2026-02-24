import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { CharacterMention } from './extensions/CharacterMention'
import { useProjectStore } from '@/stores/projectStore'
import { useSaveStatusStore } from '@/stores/saveStatusStore'
import { useTranslation } from 'react-i18next'
import { BubbleToolbar } from './BubbleToolbar'
import { EditorContextMenu } from './EditorContextMenu'
import { calculateWordCount } from '@/lib/utils'

const AUTO_SAVE_DELAY = 2000

export function BlockEditor() {
  const { t } = useTranslation()
  const { currentChapter, updateChapterContent, updateChapter } = useProjectStore()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastChapterIdRef = useRef<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<ReturnType<typeof useEditor>>(null)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: t('editor.placeholder'),
      }),
      CharacterCount,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Highlight.configure({
        multicolor: true,
      }),
      CharacterMention,
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-full px-5 pt-1 pb-10 text-text-primary',
      },
    },
    onUpdate: ({ editor }) => {
      if (!currentChapter) return

      useSaveStatusStore.getState().setModified()
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = setTimeout(async () => {
        useSaveStatusStore.getState().setSaving()
        const content = editor.getJSON()
        const text = editor.getText()
        const stats = calculateWordCount(text)
        await updateChapterContent(currentChapter.id, content)
        await updateChapter(currentChapter.id, { wordCount: stats.charactersNoSpaces })
        useSaveStatusStore.getState().setSaved()
      }, AUTO_SAVE_DELAY)
    },
  })
  editorRef.current = editor

  // Native DOM contextmenu listener on wrapper (capture phase).
  // Capture phase fires before any child handlers, so even if ProseMirror
  // calls stopPropagation, this will fire first.
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const handler = (e: MouseEvent) => {
      // Only show context menu when editor is active
      if (!editorRef.current) return
      e.preventDefault()
      setContextMenu({ x: e.clientX, y: e.clientY })
    }
    el.addEventListener('contextmenu', handler, true) // capture phase
    return () => el.removeEventListener('contextmenu', handler, true)
  }, [])

  useEffect(() => {
    if (!editor || !currentChapter) return
    if (lastChapterIdRef.current === currentChapter.id) return
    lastChapterIdRef.current = currentChapter.id

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    if (currentChapter.content) {
      editor.commands.setContent(currentChapter.content)
    } else {
      editor.commands.clearContent()
    }
  }, [editor, currentChapter])

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [])

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  // Always render the wrapper so the ref is available for the contextmenu listener.
  // Show placeholder or editor content inside.
  return (
    <div ref={wrapperRef} className="flex-1 overflow-y-auto">
      {!currentChapter ? (
        <div className="h-full flex items-center justify-center text-text-muted text-sm">
          {t('editor.placeholder')}
        </div>
      ) : (
        <>
          {editor && <BubbleToolbar editor={editor} />}
          <EditorContent editor={editor} className="min-h-full" />
          {editor && (
            <EditorContextMenu
              editor={editor}
              position={contextMenu}
              onClose={handleCloseContextMenu}
            />
          )}
        </>
      )}
    </div>
  )
}

export function flushEditorSave() {
  // TODO: implement flush mechanism
}
