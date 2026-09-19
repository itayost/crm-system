const BRIEF_TIME_ZONE = process.env.BRIEF_TIME_ZONE ?? 'Asia/Jerusalem'

const PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: BRIEF_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
})

function partsAt(instant: number) {
  const parts = PARTS.formatToParts(new Date(instant))
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Intl renders midnight as hour 24 in some locales; % 24 folds it back.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  }
}

/**
 * How far ahead of UTC the zone is at a given real instant, in milliseconds.
 *
 * Read from the zone at that instant rather than assumed, which is the whole
 * point: the offset is +02:00 for part of the year and +03:00 for the rest,
 * and it changes mid-day twice a year.
 */
function offsetMsAt(instant: number): number {
  const p = partsAt(instant)
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - instant
}

/**
 * Midnight in Israel, as a UTC instant.
 *
 * Computes the instant local midnight *happened*, rather than subtracting
 * elapsed time from `now`.
 *
 * The subtraction approach is what this function used to do, and it was wrong
 * on exactly the two days a year the offset changes (issue #26). It took the
 * wall-clock digits, worked out how far they sat past midnight, and subtracted
 * that from `now`. But wall-clock elapsed and real elapsed are only equal when
 * the offset holds all day. On the spring-forward day 10:00 local is ten
 * wall-clock hours after midnight and nine real ones, so subtracting ten
 * overshot and returned 23:00 on the *previous calendar day*; on the fall-back
 * day it undershot by an hour. Both `money.service`'s ledger boundaries and
 * `today.service`'s staleness windows read this, so those two days computed
 * against the wrong span.
 *
 * Instead: take the local calendar date, treat midnight on it as a wall-clock
 * value, and convert that to a real instant by removing the zone's offset. The
 * offset has to be sampled twice because the first sample is taken at the
 * wrong instant — on a transition day the offset at "midnight as if UTC" can
 * differ from the offset at actual local midnight. The second pass samples at
 * the candidate answer and converges.
 *
 * Israel's transitions happen at 02:00, so local midnight itself is never
 * ambiguous or skipped: there is always exactly one instant that renders as
 * 00:00:00 on a given calendar day. That is what makes two passes sufficient.
 */
export function startOfIsraelDay(now: Date): Date {
  const { year, month, day } = partsAt(now.getTime())

  // Local midnight's wall-clock reading, held as if it were UTC.
  const wallClockMidnight = Date.UTC(year, month - 1, day)

  const firstPass = wallClockMidnight - offsetMsAt(wallClockMidnight)
  return new Date(wallClockMidnight - offsetMsAt(firstPass))
}
