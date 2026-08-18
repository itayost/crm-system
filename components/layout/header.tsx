'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Search, LogOut, Keyboard } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'

import { Button } from '@/components/ui/button'
import { StatusPill } from '@/components/ui/status-pill'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ALL_NAV, isActiveHref } from './nav-items'
import { useBadges } from './badges-provider'
import { CommandPalette } from './command-palette'

const SHORTCUTS: [string, string][] = [
  ['⌘K', 'חיפוש ופעולות'],
  ['/', 'חיפוש ברשימה'],
  ['Esc', 'סגירת חלון'],
]

function initials(name?: string | null) {
  if (!name) return 'מ'
  const parts = name.trim().split(/\s+/)
  return parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
}

/**
 * A 44px band with three jobs: where you are, how to get anywhere, and whether
 * the bot is talking to clients.
 *
 * Gone: the greeting, a clock that re-rendered the header every sixty seconds,
 * a permanently-disabled dark-mode button - an advertisement for a feature that
 * was decided against - and a "פרופיל" menu item that routed to `/`.
 */
export function Header() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const badges = useBadges()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const current = ALL_NAV.find((item) => isActiveHref(pathname, item.href))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // `event.code`, never `event.key`. With a Hebrew layout active the key
      // for this physical button is 'ק', so a `key === "k"` check dies the
      // moment you are actually working in Hebrew - which is always.
      if (e.code === 'KeyK' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <header className="flex h-shell-header shrink-0 items-center gap-2 border-b bg-card px-3">
      <span className="truncate text-ui-sm font-semibold text-content-strong md:hidden">
        {current?.label ?? 'ItayOst'}
      </span>
      <span className="hidden text-ui-xs text-content-subtle md:inline">{current?.label}</span>

      <button
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="חיפוש ופעולות"
        className="flex h-control max-w-md flex-1 items-center gap-2 rounded-md border bg-surface-subtle px-2.5 text-ui-xs text-content-faint transition-colors duration-fast hover:border-border-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search aria-hidden className="size-3.5" />
        <span className="hidden truncate sm:inline">חיפוש לקוח, פרויקט, פעולה...</span>
        <kbd
          dir="ltr"
          className="ms-auto hidden rounded border border-border-strong border-b-2 bg-card px-1 font-mono text-ui-2xs text-content-subtle sm:inline"
        >
          ⌘K
        </kbd>
      </button>

      {/*
        The single most useful thing in this bar. isBotPaused() is read per
        request from the environment and has never been surfaced anywhere, so
        "the bot went quiet" was a question answered by reading a deploy log.
      */}
      <span className="ms-auto hidden sm:inline" data-testid="bot-status">
        {badges.botPaused ? (
          <StatusPill tone="caution" dot>
            הבוט מושהה
          </StatusPill>
        ) : (
          <StatusPill tone="success" emphasis="quiet" dot>
            הבוט פעיל
          </StatusPill>
        )}
      </span>

      <Button
        variant="ghost"
        size="icon"
        className="hidden size-7 md:inline-flex"
        aria-label="קיצורי מקלדת"
        onClick={() => setShortcutsOpen(true)}
      >
        <Keyboard aria-hidden className="size-4" />
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7" aria-label="תפריט משתמש">
            <span className="grid size-6 place-items-center rounded-full bg-surface-muted text-ui-2xs font-semibold text-content-muted">
              {initials(session?.user?.name)}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <span className="block text-ui-sm font-medium">{session?.user?.name ?? 'משתמש'}</span>
            <span className="block text-ui-2xs text-content-subtle">{session?.user?.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
            <Keyboard className="size-4" />
            קיצורי מקלדת
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => signOut()} className="text-tone-danger-foreground">
            <LogOut className="size-4" />
            התנתק
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />

      {/* The old dialog was titled "קיצורי מקלדת" and listed four URLs. */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>קיצורי מקלדת</DialogTitle>
          </DialogHeader>
          <dl className="divide-y">
            {SHORTCUTS.map(([key, what]) => (
              <div key={key} className="flex items-center justify-between py-2">
                <dt className="text-ui-sm text-content-body">{what}</dt>
                <dd>
                  <kbd
                    dir="ltr"
                    className="inline-block rounded border border-border-strong border-b-2 bg-surface-muted px-1.5 py-0.5 font-mono text-ui-2xs"
                  >
                    {key}
                  </kbd>
                </dd>
              </div>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </header>
  )
}
