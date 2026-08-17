import { MessageCircle } from 'lucide-react'

import { portalButton } from '@/components/portal/portal-button'
import { whatsappLink } from '@/lib/portal/whatsapp-link'

/**
 * A rotated or mistyped token.
 *
 * This screen existed three times, copy-pasted into the home, list and project
 * pages, which is three chances for one of them to drift into a dead end. It is
 * one component now.
 *
 * It says what probably happened and offers a human, because a client whose
 * link stopped working is the client who most needs to reach one - and rotating
 * the token from /clients/[id] is exactly how access gets revoked, so this is a
 * screen we cause on purpose.
 */
export function InvalidToken() {
  const whatsapp = whatsappLink()

  return (
    <div className="flex min-h-[55vh] flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-display text-portal-title font-medium text-content-strong">
        הקישור אינו תקין
      </h1>
      <p className="max-w-sm text-portal-base text-content-muted">
        ייתכן שהקישור התחלף. אפשר לבקש קישור חדש, ובינתיים פשוט לכתוב לנו.
      </p>
      {whatsapp && (
        <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={portalButton('ink')}>
          <MessageCircle aria-hidden className="size-[18px]" />
          כתבו לנו בוואטסאפ
        </a>
      )}
    </div>
  )
}
