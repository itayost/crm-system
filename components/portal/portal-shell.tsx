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
 */
export function PortalHeader() {
  return (
    <header className="sticky top-0 z-sticky flex h-11 items-center gap-2 border-b bg-card px-4">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-primary text-ui-2xs font-bold text-primary-foreground">
        IO
      </span>
      <span className="text-ui-sm font-semibold text-content-strong">ItayOst</span>
      <span className="ms-auto text-ui-xs text-content-subtle">שירות ותמיכה</span>
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
    <footer className="mt-10 flex flex-col gap-1.5 border-t px-4 py-5 text-ui-xs text-content-subtle">
      <span>נוצר על ידי ItayOst</span>
      {whatsapp && (
        <a
          href={whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-max items-center gap-1.5 text-link hover:underline"
        >
          <MessageCircle aria-hidden className="size-3.5" />
          יש שאלה? כתבו לנו בוואטסאפ
        </a>
      )}
      <span className="text-content-faint">הקישור אישי, נא לא לשתף.</span>
    </footer>
  )
}
