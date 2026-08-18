import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The portal's page furniture.
 *
 * Extracted because five pages were hand-typing the same three things at four
 * different sizes - `text-2xl font-bold` here, `text-xl font-semibold` there -
 * which is how the surface ended up mixing the console scale with raw Tailwind
 * defaults in the same document.
 */

/** The one-sentence answer a client arrives for. At most one per page. */
export function PortalAnswer({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-balance font-display text-portal-display font-medium text-content-strong">
      {children}
    </h1>
  )
}

/** A page that is about a thing rather than about a question. */
export function PortalTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="text-balance font-display text-portal-title font-medium text-content-strong">
      {children}
    </h1>
  )
}

export function PortalSection({
  heading,
  aside,
  className,
  children,
}: {
  heading?: string
  aside?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn('flex flex-col gap-3', className)}>
      {(heading || aside) && (
        <div className="flex items-baseline justify-between gap-3">
          {heading && (
            <h2 className="text-portal-sm font-semibold text-content-strong">{heading}</h2>
          )}
          {aside && <span className="text-portal-2xs text-content-muted">{aside}</span>}
        </div>
      )}
      {children}
    </section>
  )
}

/**
 * The way back.
 *
 * The chevron points *right*, which is forward-to-back in RTL. Rotating it or
 * using a left chevron here would point at the direction the reader came from
 * in a language they do not read.
 */
export function PortalBack({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex w-max items-center gap-1 text-portal-xs font-medium text-content-muted hover:text-content-strong"
    >
      <ChevronRight aria-hidden className="size-4" />
      {children}
    </Link>
  )
}

/** A card. The portal is allowed elevation; the console is not. */
export function PortalCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-lg border bg-card p-4 shadow-e1', className)}>{children}</div>
  )
}
