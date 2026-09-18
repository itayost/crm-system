const BRIEF_TIME_ZONE = process.env.BRIEF_TIME_ZONE ?? 'Asia/Jerusalem'

/**
 * Midnight in Israel, expressed as a UTC instant. Derived from the zone rather
 * than a fixed offset so it stays correct across daylight saving.
 */
export function startOfIsraelDay(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRIEF_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const localMidnightAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'))
  const localNowAsUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second')
  )

  // now - (elapsed since local midnight) = the instant local midnight happened.
  // The milliseconds have to come off separately: Intl parts stop at seconds,
  // so without this the "boundary" sat a few hundred ms after midnight and a
  // task due at exactly 00:00:00.000 counted as overdue.
  return new Date(
    now.getTime() - (localNowAsUtc - localMidnightAsUtc) - now.getMilliseconds()
  )
}
