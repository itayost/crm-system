'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MoreHorizontal, X } from 'lucide-react'

import { cn } from '@/lib/utils'
import { NAV_PRIMARY, NAV_REGISTRY, NAV_FOOTER, isActiveHref } from './nav-items'
import { NavBadge } from './nav-badge'

const BAR = NAV_PRIMARY.filter((item) => item.mobile).slice(0, 3)
const SHEET = [
  ...NAV_PRIMARY.filter((item) => !item.mobile),
  ...NAV_REGISTRY,
  ...NAV_FOOTER,
]

/**
 * The owner side on a phone.
 *
 * Three destinations plus "עוד", in the thumb zone. A phone is a triage device
 * here, not a browsing one - you open it to see what is waiting, not to audit
 * the client roster - so the day items get the bar and the registries go behind
 * the sheet.
 *
 * Badges are dots rather than numbers at this size: the number does not fit,
 * and the only useful information is "something is waiting".
 */
export function MobileNav() {
  const pathname = usePathname()
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <>
      <nav
        aria-label="ניווט"
        className="fixed inset-x-0 bottom-0 z-nav flex h-14 border-t bg-card pb-1 md:hidden"
      >
        {BAR.map((item) => {
          const Icon = item.icon
          const active = isActiveHref(pathname, item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 text-ui-2xs',
                active ? 'font-semibold text-content-strong' : 'text-content-subtle',
              )}
            >
              <NavBadge item={item} compact />
              <Icon aria-hidden className={cn('size-[18px]', active ? 'opacity-100' : 'opacity-65')} />
              {item.label}
            </Link>
          )
        })}

        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          aria-expanded={sheetOpen}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-ui-2xs text-content-subtle"
        >
          <MoreHorizontal aria-hidden className="size-[18px] opacity-65" />
          עוד
        </button>
      </nav>

      {sheetOpen && (
        <div className="fixed inset-0 z-modal md:hidden">
          <button
            type="button"
            aria-label="סגירה"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-lg border-t bg-card p-2 pb-6 shadow-e2">
            <div className="flex items-center justify-between px-2 pb-1">
              <span className="text-ui-sm font-semibold text-content-strong">ניווט</span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="סגירה"
                className="rounded-md p-1.5 text-content-subtle"
              >
                <X aria-hidden className="size-4" />
              </button>
            </div>

            {SHEET.map((item) => {
              const Icon = item.icon
              const active = isActiveHref(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSheetOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-11 items-center gap-3 rounded-md px-2.5 text-ui-md',
                    active
                      ? 'bg-surface-muted font-semibold text-content-strong'
                      : 'text-content-body',
                  )}
                >
                  <Icon aria-hidden className="size-4 shrink-0 opacity-65" />
                  <span className="flex-1">{item.label}</span>
                  <NavBadge item={item} />
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
