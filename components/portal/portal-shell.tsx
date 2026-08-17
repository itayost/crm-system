import { MessageCircle } from 'lucide-react'

/**
 * The portal's identity.
 *
 * The whole chrome used to be one line - `<main class="mx-auto max-w-2xl p-4">`
 * - with no logo, no header and no footer anywhere. The only name a client ever
 * saw was their *own* business name as the <h1>, so a link forwarded to a
 * colleague read like the client's own site rather than like something we sent
 * them. This matters twice: identifying whose system it is, and being worth
 * showing on a proposal call.
 *
 * Taller than the console's 44px header because nothing here is competing for
 * vertical space with a seven-column table.
 */
export function PortalHeader() {
  return (
    <header className="sticky top-0 z-sticky flex h-14 items-center gap-2.5 border-b bg-surface-app px-gutter">
      <span className="grid size-7 shrink-0 place-items-center rounded-sm bg-primary text-portal-2xs font-semibold text-primary-foreground">
        IO
      </span>
      <span className="text-portal-lg font-semibold text-content-strong">ItayOst</span>
      <span className="ms-auto text-portal-xs text-content-muted">שירות ותמיכה</span>
    </header>
  )
}

/**
 * Three lines, and each one earns its place.
 *
 * The WhatsApp link because the conversation lives there and the portal exists
 * only for the two things WhatsApp is bad at. The last line is a security
 * control written as copy: the URL is the credential, so "do not share it" is
 * the only access rule a client can actually follow.
 */
export function PortalFooter({ whatsapp }: { whatsapp: string | null }) {
  return (
    <footer className="mt-12 flex flex-col gap-2 border-t px-gutter py-6 text-portal-xs text-content-muted">
      <span>נוצר על ידי ItayOst</span>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-max items-center gap-1.5 font-semibold text-link underline decoration-border-strong underline-offset-4 hover:decoration-current"
        >
          <MessageCircle aria-hidden className="size-4" />
          יש שאלה? כתבו לנו בוואטסאפ
        </a>
      )}
      <span className="text-content-faint">הקישור אישי, נא לא לשתף.</span>
    </footer>
  )
}
