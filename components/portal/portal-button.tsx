import { cn } from '@/lib/utils'

/**
 * The portal's controls, at the portal's scale.
 *
 * `components/ui/button.tsx` is still stock shadcn: `h-10`, `rounded-md`,
 * `text-sm`. Those are console numbers. A client answers a quote one-handed on
 * a phone, so every control here is 48px (`h-control`, which the portal scope
 * re-points from 26px) and 17px.
 *
 * A class helper rather than a component, because the same treatment has to
 * land on a <button>, a <Link> and an <a href="wa.me/...">, and wrapping each
 * of those would be three components that must not drift apart.
 */
export type PortalButtonTone = 'ink' | 'ghost' | 'quiet'

const BASE =
  'inline-flex h-control items-center justify-center gap-2 rounded-md px-5 text-portal-base font-semibold ' +
  'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface-app disabled:pointer-events-none disabled:opacity-50'

const TONE: Record<PortalButtonTone, string> = {
  /** The one action the screen exists for. At most one per screen. */
  ink: 'border border-primary bg-primary text-primary-foreground hover:bg-primary/90',
  /** The real alternative next to it - declining a quote is not a lesser act. */
  ghost: 'border border-border-strong bg-transparent text-content-body hover:bg-surface-subtle',
  /** A secondary affordance inside a section, not the page's answer. */
  quiet: 'border border-border bg-card text-content-strong hover:bg-surface-subtle',
}

export function portalButton(tone: PortalButtonTone = 'ink', className?: string) {
  return cn(BASE, TONE[tone], className)
}

export function PortalButton({
  tone = 'ink',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: PortalButtonTone }) {
  return <button className={portalButton(tone, className)} {...props} />
}
