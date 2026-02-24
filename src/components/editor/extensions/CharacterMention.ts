import Mention from '@tiptap/extension-mention'
import { ReactRenderer } from '@tiptap/react'
import tippy, { type Instance as TippyInstance } from 'tippy.js'
import { CharacterMentionList } from './CharacterMentionList'
import { useWorldStore } from '@/stores/worldStore'

export const CharacterMention = Mention.configure({
  HTMLAttributes: {
    class: 'character-mention',
  },
  suggestion: {
    char: '@',
    items: ({ query }: { query: string }) => {
      const characters = useWorldStore.getState().characters
      const lower = query.toLowerCase()
      return characters
        .filter(c =>
          c.name.toLowerCase().includes(lower) ||
          c.aliases.some(a => a.toLowerCase().includes(lower)),
        )
        .slice(0, 10)
    },
    render: () => {
      let component: ReactRenderer | null = null
      let popup: TippyInstance[] | null = null

      return {
        onStart: (props: any) => {
          component = new ReactRenderer(CharacterMentionList, {
            props,
            editor: props.editor,
          })

          if (!props.clientRect) return

          popup = tippy('body', {
            getReferenceClientRect: props.clientRect,
            appendTo: () => document.body,
            content: component.element,
            showOnCreate: true,
            interactive: true,
            trigger: 'manual',
            placement: 'bottom-start',
          })
        },
        onUpdate(props: any) {
          component?.updateProps(props)
          if (popup?.[0] && props.clientRect) {
            popup[0].setProps({
              getReferenceClientRect: props.clientRect,
            })
          }
        },
        onKeyDown(props: any) {
          if (props.event.key === 'Escape') {
            popup?.[0]?.hide()
            return true
          }
          return (component?.ref as any)?.onKeyDown(props)
        },
        onExit() {
          popup?.[0]?.destroy()
          component?.destroy()
        },
      }
    },
  },
})
