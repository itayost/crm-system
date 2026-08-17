'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

import { cn } from '@/lib/utils'
import { NAV_PRIMARY, NAV_REGISTRY, NAV_FOOTER, isActiveHref, type NavItem } from './nav-items'
import { NavBadge } from './nav-badge'

function initials(name?: string | null) {
  if (!name) return 'מ'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex h-8 items-center gap-2.5 rounded-md px-2.5 text-ui-sm transition-colors duration-fast',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'bg-surface-muted font-semibold text-content-strong'
          : 'text-content-body hover:bg-surface-subtle hover:text-content-strong',
      )}
    >
      <Icon aria-hidden className={cn('size-4 shrink-0', active ? 'opacity-100' : 'opacity-60')} />
      <span className="flex-1 truncate">{item.label}</span>
      <NavBadge item={item} />
    </Link>
  )
}

/**
 * The desktop navigation.
 *
 * Hidden below `md` entirely - there is no drawer here, because a phone gets
 * the bottom bar instead. This was previously a hard `w-64 h-screen` with no
 * breakpoint at all, inside a `flex h-screen overflow-hidden` shell: at 375px
 * it took 256px and left 119px for the application.
 *
 * The active item is marked with `aria-current`, not only with a colour. The
 * old one signalled active state solely through a `text-link` class, which a
 * test then asserted on - so renaming a design token broke a navigation test.
 */
export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="hidden w-shell-sidebar shrink-0 flex-col border-e bg-card md:flex">
      <div className="flex h-shell-header items-center gap-2 border-b px-3">
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-ui-2xs font-bold text-primary-foreground">
          IO
        </span>
        <span className="text-ui-sm font-semibold text-content-strong">ItayOst</span>
      </div>

      <nav aria-label="ניווט ראשי" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2">
        {NAV_PRIMARY.map((item) => (
          <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
        ))}

        <hr className="my-2 border-border" />

        {NAV_REGISTRY.map((item) => (
          <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
        ))}

        {NAV_FOOTER.length > 0 && (
          <>
            <hr className="my-2 border-border" />
            {NAV_FOOTER.map((item) => (
              <NavLink key={item.href} item={item} active={isActiveHref(pathname, item.href)} />
            ))}
          </>
        )}
      </nav>

      <div className="flex items-center gap-2 border-t p-2.5">
        <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-muted text-ui-2xs font-semibold text-content-muted">
          {initials(session?.user?.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-ui-xs font-medium text-content-strong">
            {session?.user?.name ?? 'משתמש'}
          </span>
          <span className="block text-ui-2xs text-content-subtle">עוסק פטור</span>
        </span>
      </div>
    </aside>
  )
}
