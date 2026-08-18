import Link from 'next/link'

/**
 * The portal's first navigation.
 *
 * Until now it had none: one page, and the client landed straight in a list of
 * sixteen with no way to answer "is anything waiting on me" without reading all
 * of them. Rendered server-side from the active key rather than usePathname, so
 * the whole portal stays server components.
 *
 * Labels are the nouns, not "my ___". A client on their own portal already
 * knows whose requests these are, and the possessive cost two of the three tabs
 * a line wrap at 390px.
 */
export function PortalNav({
  token,
  active,
  awaiting,
  reviews,
}: {
  token: string
  active: 'home' | 'requests' | 'projects'
  awaiting?: number
  /** Delivered phases waiting on the client. Same badge, same meaning. */
  reviews?: number
}) {
  const items = [
    { key: 'home', label: 'בית', href: `/r/${token}` },
    { key: 'requests', label: 'הפניות', href: `/r/${token}/requests`, badge: awaiting },
    { key: 'projects', label: 'הפרויקטים', href: `/r/${token}/projects`, badge: reviews },
  ] as const

  return (
    <nav className="mb-7 flex gap-6 border-b" aria-label="ניווט">
      {items.map((item) => {
        const on = item.key === active
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={
              on
                ? 'relative -mb-px flex h-12 items-center gap-2 border-b-2 border-primary text-portal-base font-semibold text-content-strong'
                : 'relative -mb-px flex h-12 items-center gap-2 border-b-2 border-transparent text-portal-base text-content-muted hover:text-content-strong'
            }
          >
            {item.label}
            {'badge' in item && item.badge ? (
              <span className="rounded-full bg-tone-caution-surface px-2 py-0.5 font-mono text-portal-2xs font-semibold tabular-nums text-tone-caution-foreground">
                <bdi>{item.badge}</bdi>
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
