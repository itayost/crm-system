import { describe, expect, it } from 'vitest'
import { phaseEntry, advanceEntry } from '@/lib/money/ledger'
import { LEDGER_STATE_LABELS, label } from '@/lib/design/labels'
import { LEDGER_STATE_TONES, toneOf } from '@/lib/design/tones'

/**
 * What a row on /money actually says, end to end.
 *
 * The visual suite cannot guard this. `maxDiffPixelRatio: 0.01` in
 * playwright.config.ts allows ~9,200 differing pixels on a 1280x720 capture,
 * and a status pill is around a thousand - so a pill changing both its colour
 * and its word slips under the budget and the baseline keeps passing while
 * showing something the app no longer renders. That is exactly what happened
 * when גבייה landed: the money baseline still showed a מקדמה as אושר in green
 * for a full release.
 *
 * These assertions are deterministic and cannot be absorbed by a pixel budget.
 */
describe('what a money row says', () => {
  const say = (state: string) => ({
    label: label(LEDGER_STATE_LABELS, state),
    tone: toneOf(LEDGER_STATE_TONES, state),
  })

  it('shows an unpaid מקדמה as collectable, not as an approved phase', () => {
    const advance = advanceEntry(3000, null)!

    expect(advance.state).toBe('collectable')
    expect(advance.phaseStatus).toBeNull()
    expect(say(advance.state)).toEqual({ label: 'לגבייה', tone: 'warning' })
  })

  it('shows signed-off unpaid work as collectable, never as success', () => {
    const phase = phaseEntry({ price: 1500, status: 'APPROVED', paidAt: null })

    expect(phase.state).toBe('collectable')
    // Money is not a status: an unpaid invoice is not a success just because
    // the work behind it was approved.
    expect(say(phase.state)).toEqual({ label: 'לגבייה', tone: 'warning' })
  })

  it('shows a settled phase as paid, whatever its status says', () => {
    const phase = phaseEntry({ price: 1500, status: 'APPROVED', paidAt: '2026-08-01' })

    expect(phase.state).toBe('paid')
    expect(say(phase.state)).toEqual({ label: 'שולם', tone: 'success' })
  })

  it('shows work sitting with the client as awaiting, in caution', () => {
    const phase = phaseEntry({ price: 7000, status: 'PENDING_APPROVAL', paidAt: null })

    expect(phase.state).toBe('awaitingClient')
    expect(say(phase.state)).toEqual({ label: 'ממתין לאישור לקוח', tone: 'caution' })
  })

  it('never renders an English state name to a Hebrew-speaking user', () => {
    for (const state of Object.keys(LEDGER_STATE_LABELS)) {
      expect(label(LEDGER_STATE_LABELS, state)).toMatch(/[֐-׿]/)
    }
  })
})
