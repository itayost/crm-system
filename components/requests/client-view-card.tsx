'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusPill } from '@/components/ui/status-pill'
import { CLIENT_REQUEST_STATUS_LABELS, label } from '@/lib/design/labels'
import { CLIENT_REQUEST_STATUS_TONES, toneOf } from '@/lib/design/tones'
import { clientStatusOf } from '@/lib/services/client-view'
import type { RequestRecord } from '@/lib/types/request'

/**
 * The same request, in the client's words.
 *
 * clientStatusOf() has existed since the portal shipped and was read only by
 * the portal and the WhatsApp bot - so the internal pages were the one place
 * that could not tell you what the client currently believes. That is exactly
 * the thing worth knowing before you pick up the phone.
 *
 * Renders on the server-safe derivation rather than a second copy of the rules,
 * so this card cannot drift from what /r/[token] actually shows.
 */
export function ClientViewCard({ request }: { request: RequestRecord }) {
  const state = clientStatusOf({
    status: request.status,
    quotedAt: request.quotedAt,
    clientDecision: request.clientDecision,
    clientDecisionAt: request.clientDecisionAt,
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>מה הלקוח רואה עכשיו</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {state ? (
          <>
            <StatusPill tone={toneOf(CLIENT_REQUEST_STATUS_TONES, state)} dot>
              {label(CLIENT_REQUEST_STATUS_LABELS, state)}
            </StatusPill>
            <p className="text-sm text-content-muted">{explain(state)}</p>
          </>
        ) : (
          <>
            <StatusPill tone="neutral" emphasis="quiet" dot>
              לא מוצג ללקוח
            </StatusPill>
            <p className="text-sm text-content-muted">
              פניה שנדחתה אינה מופיעה בפורטל. הלקוח לא רואה אותה ולא יקבל עליה עדכונים.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function explain(state: string): string {
  const map: Record<string, string> = {
    RECEIVED: 'הפניה התקבלה וממתינה לבדיקה שלך. הלקוח לא רואה שהיא עדיין לא סווגה.',
    SCHEDULED: 'הלקוח רואה שהפניה אושרה וממתינה לתורה. הוא לא רואה אם היא ממתינה לתמחור אצלך.',
    AWAITING_YOU: 'ההצעה מוצגת ללקוח עם כפתור אישור. עד שיאשר לא תיווצר משימה.',
    IN_PROGRESS: 'הלקוח יודע שהתחלת לעבוד. הוא יקבל הודעה כשתסמן כטופל.',
    DONE: 'הלקוח קיבל הודעה שהפניה טופלה.',
    DECLINED: 'הלקוח רואה שההצעה לא אושרה. אפשר לשלוח הצעה מתוקנת.',
  }
  return map[state] ?? ''
}
