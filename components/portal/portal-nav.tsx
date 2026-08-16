import Link from 'next/link'

/**
 * The portal's first navigation.
 *
 * Until now it had none: one page, and the client landed straight in a list of
 * sixteen with no way to answer "is anything waiting on me" without reading all
 * of them. Rendered server-side from the active key rather than usePathname, so
 * the whole portal stays server components.
 */
export function PortalNav({
  token,
  active,
  awaiting,
}: {
  token: string
  active: 'home' | 'requests' | 'projects'
  awaiting?: number
}) {
  const items = [
    { key: 'home', label: 'בית', href: `/r/${token}` },
    { key: 'requests', label: 'הפניות שלי', href: `/r/${token}/requests`, badge: awaiting },
    { key: 'projects', label: 'הפרויקטים שלי', href: `/r/${token}/projects` },
  ] as const

  return (
    <nav className="mb-6 flex gap-1 border-b border-border" aria-label="ניווט">
      {items.map((item) => {
        const on = item.key === active
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={
              on
                ? 'relative -mb-px border-b-2 border-primary px-3 py-2 text-sm font-semibold text-content-strong'
                : 'relative -mb-px border-b-2 border-transparent px-3 py-2 text-sm text-content-muted hover:text-content-strong'
            }
          >
            {item.label}
            {'badge' in item && item.badge ? (
              <span className="mr-1.5 rounded-full bg-tone-caution-surface px-1.5 py-0.5 text-xs font-bold text-tone-caution-foreground">
                <bdi>{item.badge}</bdi>
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
