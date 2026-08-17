'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CornerDownLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { ALL_NAV } from './nav-items'

interface Action {
  id: string
  label: string
  hint?: string
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  run: () => void
}

/**
 * Jump anywhere, create anything.
 *
 * This first cut covers navigation and creation. Entity search - phone number
 * first, because the WhatsApp workflow is "a number arrives, paste it, land on
 * the person" - needs its own endpoint and arrives with it.
 */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)

  const actions = useMemo<Action[]>(() => {
    const go: Action[] = ALL_NAV.map((item) => ({
      id: `go:${item.href}`,
      label: item.label,
      hint: 'מעבר',
      icon: item.icon,
      run: () => router.push(item.href),
    }))

    const create: Action[] = [
      { id: 'new:project', label: 'פרויקט חדש', href: '/projects?new=true' },
      { id: 'new:client', label: 'לקוח חדש', href: '/clients?new=true' },
      { id: 'new:task', label: 'משימה חדשה', href: '/tasks?new=true' },
      { id: 'new:request', label: 'פנייה חדשה', href: '/requests?new=true' },
    ].map((a) => ({
      id: a.id,
      label: a.label,
      hint: 'יצירה',
      icon: Plus,
      run: () => router.push(a.href),
    }))

    return [...go, ...create]
  }, [router])

  const results = useMemo(() => {
    const q = query.trim()
    if (!q) return actions
    return actions.filter((a) => a.label.includes(q))
  }, [actions, query])

  useEffect(() => {
    if (open) {
      setQuery('')
      setCursor(0)
    }
  }, [open])

  useEffect(() => {
    setCursor(0)
  }, [query])

  const choose = (action?: Action) => {
    if (!action) return
    onOpenChange(false)
    action.run()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">חיפוש ופעולות</DialogTitle>

        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="לאן ללכת, או מה ליצור..."
          aria-label="חיפוש ופעולות"
          className="h-11 w-full border-b bg-transparent px-4 text-ui-md outline-none placeholder:text-content-faint"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(c + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              choose(results[cursor])
            }
          }}
        />

        <ul className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-ui-sm text-content-subtle">
              אין תוצאות
            </li>
          )}
          {results.map((action, i) => {
            const Icon = action.icon
            return (
              <li key={action.id}>
                <button
                  type="button"
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => choose(action)}
                  className={cn(
                    'flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-ui-sm',
                    i === cursor
                      ? 'bg-surface-muted text-content-strong'
                      : 'text-content-body',
                  )}
                >
                  {Icon && <Icon aria-hidden className="size-4 shrink-0 opacity-60" />}
                  <span className="flex-1 text-start">{action.label}</span>
                  {action.hint && (
                    <span className="text-ui-2xs text-content-faint">{action.hint}</span>
                  )}
                  {i === cursor && (
                    <CornerDownLeft aria-hidden className="size-3.5 text-content-faint" />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
