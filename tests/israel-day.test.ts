import { describe, expect, it } from 'vitest'
import { startOfIsraelDay } from '@/lib/utils/israel-day'

/**
 * startOfIsraelDay is a DST-aware, millisecond-sensitive date helper with two
 * live consumers: money.service's ledger period boundaries and
 * today.service's overdue/quiet-lead windows. It moved out of the deleted
 * morning-brief service in the 2026-09 teardown (see ADR 0004), along with
 * the only test that ever exercised its midnight-boundary math
 * ('starts the new-leads window on a midnight, not on the cron time', in the
 * deleted tests/morning-brief-next-actions.test.ts). These tests replace
 * that coverage at the helper's new home, plus the DST cases nothing
 * previously verified.
 *
 * Coverage stops at each transition day's own transition instant: both
 * "picks the ... day itself" cases below pick a `now` that is still on the
 * pre-jump side of the clock change. `startOfIsraelDay` has a genuine,
 * pre-existing off-by-one-hour bug for `now` values after that instant (for
 * example 2026-03-27 10:00 local returns the previous calendar day) -
 * tracked as issue #26 and deliberately not fixed here. Do not read these two
 * tests as proof DST is handled correctly across the whole transition day.
 */

const IST_OFFSET_MS = 2 * 60 * 60 * 1000

/** Formats an instant as Israel wall-clock date and time, for an independent check. */
function israelWallClock(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

describe('startOfIsraelDay', () => {
  it('returns the same instant when now is exactly local midnight', () => {
    // 2026-01-15T00:00:00.000 in Israel (IST, UTC+2) is 2026-01-14T22:00:00.000Z.
    // The milliseconds have to come off separately - without that, the
    // boundary sat a few hundred ms after midnight and a task due at exactly
    // 00:00:00.000 counted as overdue. Asserting getTime() equality, not
    // closeness, is what would catch that regression.
    const now = new Date('2026-01-14T22:00:00.000Z')

    expect(startOfIsraelDay(now).getTime()).toBe(now.getTime())
  })

  it('returns that day\'s local midnight for an arbitrary mid-day now', () => {
    // 2026-01-15T14:30:00 Israel local (IST, UTC+2) is 2026-01-15T12:30:00Z.
    const now = new Date('2026-01-15T12:30:00.000Z')

    // Independently derived: the calendar date's UTC-numbered midnight minus
    // that date's known standard-time offset, rather than trusting the
    // implementation's own arithmetic.
    const expected = Date.UTC(2026, 0, 15) - IST_OFFSET_MS

    expect(startOfIsraelDay(now).getTime()).toBe(expected)
  })

  it('zeroes out the boundary in Israel standard time (IST, UTC+2)', () => {
    const now = new Date('2026-01-20T10:15:33.123Z')
    const result = startOfIsraelDay(now)

    expect(result.getUTCMinutes()).toBe(0)
    expect(result.getUTCSeconds()).toBe(0)
    expect(result.getUTCMilliseconds()).toBe(0)
    // IST is UTC+2, so local midnight is 22:00 UTC the previous day.
    expect(result.toISOString()).toBe('2026-01-19T22:00:00.000Z')
  })

  it('zeroes out the boundary in Israel daylight time (IDT, UTC+3)', () => {
    // This is the case that actually proves the doc comment's claim that the
    // function "stays correct across daylight saving" - nothing else here
    // exercises IDT.
    const now = new Date('2026-07-20T10:15:33.123Z')
    const result = startOfIsraelDay(now)

    expect(result.getUTCMinutes()).toBe(0)
    expect(result.getUTCSeconds()).toBe(0)
    expect(result.getUTCMilliseconds()).toBe(0)
    // IDT is UTC+3, so local midnight is 21:00 UTC the previous day.
    expect(result.toISOString()).toBe('2026-07-19T21:00:00.000Z')
  })

  it('picks the spring-forward day itself, not the neighbouring day', () => {
    // Israel moves clocks forward on the Friday before the last Sunday of
    // March; in 2026 that is March 27, 02:00 IST -> 03:00 IDT. `now` here is
    // 01:15 local on that day, still IST (the jump has not happened yet) -
    // the case a fixed-offset implementation would get wrong by assuming the
    // wrong side of the jump for the whole day.
    // Coverage stops there: a `now` after the 02:00 jump hits the off-by-one
    // bug tracked in issue #26 and is not asserted here.
    const now = new Date('2026-03-26T23:15:00.000Z') // 2026-03-27T01:15 IST
    const result = startOfIsraelDay(now)

    expect(result.toISOString()).toBe('2026-03-26T22:00:00.000Z')
    expect(israelWallClock(result)).toBe('2026-03-27, 00:00:00')
    // Not shifted by the hour the spring-forward jump moves.
    expect(result.getUTCHours()).toBe(22)
  })

  it('picks the fall-back day itself, not the neighbouring day', () => {
    // Israel moves clocks back on the last Sunday of October; in 2026 that is
    // October 25, 02:00 IDT -> 01:00 IST. `now` here is 00:45 local on that
    // day, still IDT (before the repeated hour).
    // Coverage stops there: a `now` after the 02:00 jump hits the off-by-one
    // bug tracked in issue #26 and is not asserted here.
    const now = new Date('2026-10-24T21:45:00.000Z') // 2026-10-25T00:45 IDT
    const result = startOfIsraelDay(now)

    expect(result.toISOString()).toBe('2026-10-24T21:00:00.000Z')
    expect(israelWallClock(result)).toBe('2026-10-25, 00:00:00')
    // Not shifted by the hour the fall-back jump moves.
    expect(result.getUTCHours()).toBe(21)
  })

  it('rolls the year and month over correctly just after New Year midnight', () => {
    // 2026-01-01T00:30:00 Israel local (IST, UTC+2) is 2025-12-31T22:30:00Z.
    // Exercises the `month - 1` arithmetic across both a month and a year
    // boundary, which is easy to get wrong at exactly this kind of edge.
    const now = new Date('2025-12-31T22:30:00.000Z')
    const result = startOfIsraelDay(now)

    expect(result.toISOString()).toBe('2025-12-31T22:00:00.000Z')
    expect(israelWallClock(result)).toBe('2026-01-01, 00:00:00')
  })
})
