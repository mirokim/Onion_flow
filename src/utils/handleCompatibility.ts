import type { HandleDataType } from '@nodes/types'

/**
 * Pure function: check whether a source handle type is compatible with a target handle's accepted types.
 * Wildcard ('*') is always compatible in either direction.
 */
export function isTypeCompatible(srcType: HandleDataType, accepts: HandleDataType[]): boolean {
  return srcType === '*' || accepts.includes('*') || accepts.includes(srcType)
}
