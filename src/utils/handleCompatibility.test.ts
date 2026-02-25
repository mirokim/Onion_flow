import { describe, it, expect } from 'vitest'
import { isTypeCompatible } from './handleCompatibility'
import type { HandleDataType } from '@nodes/types'

describe('isTypeCompatible', () => {
  it('wildcard source ("*") is compatible with any target accepts list', () => {
    expect(isTypeCompatible('*', ['CONTEXT'])).toBe(true)
    expect(isTypeCompatible('*', ['DIRECTION'])).toBe(true)
    expect(isTypeCompatible('*', ['PLOT'])).toBe(true)
    expect(isTypeCompatible('*', ['CHARACTER'])).toBe(true)
    expect(isTypeCompatible('*', ['TEXT'])).toBe(true)
    expect(isTypeCompatible('*', [])).toBe(true)
  })

  it('wildcard in accepts list accepts any source type', () => {
    expect(isTypeCompatible('CONTEXT', ['*'])).toBe(true)
    expect(isTypeCompatible('DIRECTION', ['*'])).toBe(true)
    expect(isTypeCompatible('PLOT', ['*'])).toBe(true)
    expect(isTypeCompatible('CHARACTER', ['*'])).toBe(true)
    expect(isTypeCompatible('TEXT', ['*'])).toBe(true)
  })

  it('DIRECTION → DIRECTION is compatible', () => {
    expect(isTypeCompatible('DIRECTION', ['DIRECTION'])).toBe(true)
  })

  it('DIRECTION → DIRECTION with multiple accepts is compatible', () => {
    expect(isTypeCompatible('DIRECTION', ['DIRECTION', '*'])).toBe(true)
  })

  it('CONTEXT → DIRECTION is not compatible', () => {
    expect(isTypeCompatible('CONTEXT', ['DIRECTION'])).toBe(false)
  })

  it('PLOT → CONTEXT target is not compatible', () => {
    expect(isTypeCompatible('PLOT', ['CONTEXT', 'CHARACTER', 'TEXT'])).toBe(false)
  })

  it('PLOT → plot handle (accepts PLOT) is compatible', () => {
    expect(isTypeCompatible('PLOT', ['PLOT'])).toBe(true)
  })

  it('PLOT → multi-type accepts that includes PLOT is compatible', () => {
    expect(isTypeCompatible('PLOT', ['PLOT', 'CONTEXT', '*'])).toBe(true)
  })

  it('TEXT → TEXT is compatible', () => {
    expect(isTypeCompatible('TEXT', ['TEXT'])).toBe(true)
  })

  it('CHARACTER → CHARACTER is compatible', () => {
    expect(isTypeCompatible('CHARACTER', ['CHARACTER'])).toBe(true)
  })

  it('CHARACTER → CONTEXT is not compatible', () => {
    expect(isTypeCompatible('CHARACTER', ['CONTEXT'])).toBe(false)
  })

  it('empty accepts list with non-wildcard source is not compatible', () => {
    expect(isTypeCompatible('CONTEXT', [])).toBe(false)
  })

  it('storyteller context handle: CONTEXT and CHARACTER are accepted', () => {
    const storytellerContextAccepts: HandleDataType[] = ['CONTEXT', 'CHARACTER', 'TEXT']
    expect(isTypeCompatible('CONTEXT', storytellerContextAccepts)).toBe(true)
    expect(isTypeCompatible('CHARACTER', storytellerContextAccepts)).toBe(true)
    expect(isTypeCompatible('TEXT', storytellerContextAccepts)).toBe(true)
    expect(isTypeCompatible('PLOT', storytellerContextAccepts)).toBe(false)
    expect(isTypeCompatible('DIRECTION', storytellerContextAccepts)).toBe(false)
  })

  it('storyteller plot handle: only PLOT is accepted', () => {
    expect(isTypeCompatible('PLOT', ['PLOT'])).toBe(true)
    expect(isTypeCompatible('CONTEXT', ['PLOT'])).toBe(false)
  })

  it('storyteller direction handle: only DIRECTION is accepted', () => {
    expect(isTypeCompatible('DIRECTION', ['DIRECTION'])).toBe(true)
    expect(isTypeCompatible('CONTEXT', ['DIRECTION'])).toBe(false)
  })
})
