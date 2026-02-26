/**
 * Brainstorming Waiter — pause/resume mechanism for the brainstorming node.
 *
 * When a brainstorming node is executed it generates choices and then
 * suspends execution by returning a Promise that does not resolve until
 * the user picks an option in the UI.
 *
 * Usage:
 *  - `execute()` plugin calls `waitForSelection(nodeId)` and awaits it.
 *  - The body component calls `resolveSelection(nodeId, text)` on click.
 */

/** Map of nodeId → Promise resolver */
const waiters = new Map<string, (choice: string) => void>()

/**
 * Returns a Promise that resolves when the user selects a choice.
 * The execution loop will stay suspended here until resolved.
 */
export function waitForSelection(nodeId: string): Promise<string> {
  return new Promise((resolve) => {
    waiters.set(nodeId, resolve)
  })
}

/**
 * Called by the UI body component when the user clicks a choice.
 * Resolves the pending Promise and removes it from the map.
 */
export function resolveSelection(nodeId: string, choice: string): void {
  const resolver = waiters.get(nodeId)
  if (resolver) {
    resolver(choice)
    waiters.delete(nodeId)
  }
}

/**
 * Cancel a pending selection (e.g. if execution is aborted externally).
 * The awaiting Promise will never resolve — callers should guard with a
 * timeout or abort signal if needed in the future.
 */
export function cancelSelection(nodeId: string): void {
  waiters.delete(nodeId)
}

/** Returns true if this node is currently waiting for user input. */
export function hasPendingSelection(nodeId: string): boolean {
  return waiters.has(nodeId)
}
