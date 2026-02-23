import { useEffect, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Underline from '@tiptap/extension-underline'
import TextAlign from '@tiptap/extension-text-align'
import Highlight from '@tiptap/extension-highlight'
import { useProjectStore } from '@/stores/projectStore'
import { useSaveStatusStore } from '@/stores/saveStatusStore'
import { useTranslation } from 'react-i18next'
import { BubbleToolbar } from './BubbleToolbar'
import { calculateWordCount } from '@/lib/utils'

const AUTO_SAVE_DELAY = 2000

export function BlockEditor() {
  const { t } = useTranslation()
  const { currentChapter, updateChapterContent, updateChapter } = useProjectStore()
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastChapterIdRef = useRef<string | null>(null)

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

  if (!currentChapter) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        {t('editor.placeholder')}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {editor && <BubbleToolbar editor={editor} />}
      <EditorContent editor={editor} className="min-h-full" />
    </div>
  )
}

export function flushEditorSave() {
  // TODO: implement flush mechanism
}
