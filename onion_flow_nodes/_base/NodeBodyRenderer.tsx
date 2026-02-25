import { getPlugin } from '../plugin'
import type { NodeBodyProps } from '../plugin'

/**
 * Dispatches node body rendering to the appropriate plugin's bodyComponent.
 * Replaces the 475-line if-statement block in BaseNode.tsx.
 */
export function NodeBodyRenderer(props: NodeBodyProps) {
  const plugin = getPlugin(props.data.nodeType as string)
  if (!plugin?.bodyComponent) return null
  const Body = plugin.bodyComponent
  return <Body {...props} />
}
