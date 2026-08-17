'use client'

import { cn } from '@/lib/utils'
import { useBadges } from './badges-provider'
import { shortMoney, type NavItem } from './nav-items'

/**
 * The count beside a nav item, or nothing.
 *
 * Zero renders nothing at all. That is the whole discipline: a badge is a
 * standing claim on your attention, so one that is always there stops being
 * read - and every number here can reach zero on a good day.
 */
export function NavBadge({ item, compact = false }: { item: NavItem; compact?: boolean }) {
  const badges = useBadges()
  if (!item.badge) return null

  const value = badges[item.badge]
  if (!value) return null

  if (compact) {
    // In the mobile bar there is no room for a number, and the only useful
    // information at that size is "something is waiting".
    return (
      <span
        aria-hidden
        className={cn(
          'absolute end-1/4 top-1 size-1.5 rounded-full',
          item.badgeTone === 'danger' ? 'bg-tone-danger-mark' : 'bg-tone-caution-mark',
        )}
      />
    )
  }

  return (
    <span
      data-nav-badge={item.badge}
      // A money badge is an LTR run inside an RTL page; without this the shekel
      // sign lands on the wrong side of the number.
      dir={item.badgeIsMoney ? 'ltr' : undefined}
      className={cn(
        'inline-grid h-4 min-w-4 place-items-center rounded-full px-1.5 font-mono text-ui-2xs font-semibold tabular-nums',
        item.badgeTone === 'danger' && 'bg-tone-danger-solid text-white',
        item.badgeTone === 'caution' && 'bg-tone-caution-solid text-content-strong',
        (!item.badgeTone || item.badgeTone === 'neutral') &&
          'bg-tone-neutral-surface text-tone-neutral-foreground',
      )}
    >
      {item.badgeIsMoney ? shortMoney(value) : value}
    </span>
  )
}
