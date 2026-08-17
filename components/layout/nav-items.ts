import {
  Activity,
  Inbox,
  ListTodo,
  UserPlus,
  Building2,
  Briefcase,
  Coins,
  type LucideIcon,
} from 'lucide-react'

import type { TodayBadges } from '@/lib/services/today.service'

/** The numeric badges. `botPaused` rides on the same payload but is not a count. */
export type BadgeKey = {
  [K in keyof TodayBadges]: TodayBadges[K] extends number ? K : never
}[keyof TodayBadges]

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Which badge count, if any, this item carries. */
  badge?: BadgeKey
  /** Badges that mean "act now" read louder than ones that mean "note this". */
  badgeTone?: 'danger' | 'caution' | 'neutral'
  /** Shekels rather than a count. */
  badgeIsMoney?: boolean
  /** Shown in the mobile bottom bar (max four). */
  mobile?: boolean
}

/**
 * Two blocks, separated by a rule.
 *
 * The first is the day - things that can be owed to you and can reach zero.
 * The second is the registries - complete, boring, always the same shape. The
 * old nav was six items in one undifferentiated group headed "ראשי", which
 * labelled nothing, and carried no counts at all despite the dashboard
 * computing exactly those numbers one route over.
 */
export const NAV_PRIMARY: NavItem[] = [
  // No badge on purpose: this page explains every other badge, so a number
  // here would just double-count the three below it.
  { label: 'היום', href: '/', icon: Activity, mobile: true },
  {
    label: 'פניות',
    href: '/requests',
    icon: Inbox,
    badge: 'triageRequests',
    badgeTone: 'danger',
    mobile: true,
  },
  {
    label: 'משימות',
    href: '/tasks',
    icon: ListTodo,
    badge: 'dueTasks',
    badgeTone: 'caution',
    mobile: true,
  },
  {
    label: 'לידים',
    href: '/leads',
    icon: UserPlus,
    badge: 'dueLeads',
    badgeTone: 'caution',
  },
]

export const NAV_REGISTRY: NavItem[] = [
  { label: 'לקוחות', href: '/clients', icon: Building2 },
  { label: 'פרויקטים', href: '/projects', icon: Briefcase },
  { label: 'כספים', href: '/money', icon: Coins, badge: 'outstanding', badgeIsMoney: true },
]

/**
 * Deliberately empty until /settings exists.
 *
 * A nav item pointing at a route that 404s is the same defect as the request
 * pipeline linking to `?status=` while the page only read `?queue=` - four of
 * its five links quietly went nowhere. Add הגדרות here in the same commit that
 * adds the route, not before.
 */
export const NAV_FOOTER: NavItem[] = []

export const ALL_NAV = [...NAV_PRIMARY, ...NAV_REGISTRY, ...NAV_FOOTER]

/** Compact money for a badge: ₪18.4k rather than ₪18,400. */
export function shortMoney(value: number): string {
  if (value >= 1000) return `₪${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`
  return `₪${value}`
}

export function isActiveHref(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}
