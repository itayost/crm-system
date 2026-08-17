'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

import api from '@/lib/api/client'
import { StatusPill } from '@/components/ui/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, FactRail, TonePanel, type Fact } from '@/components/patterns'

interface Health {
  botPaused: boolean
  waha: boolean
  whatsappWebhook: boolean
  ownerPhone: boolean
  github: boolean
  publicLeads: boolean
  ollama: boolean
}

function Wired({ on, note }: { on: boolean; note?: string }) {
  return (
    <span className="flex items-center gap-2">
      {on ? (
        <StatusPill tone="success" emphasis="quiet" dot>מחובר</StatusPill>
      ) : (
        <StatusPill tone="neutral" emphasis="quiet" dot>לא מוגדר</StatusPill>
      )}
      {note && <span className="text-ui-2xs text-content-faint">{note}</span>}
    </span>
  )
}

/**
 * Settings, and an honest boundary.
 *
 * חיבורים is the page you open when the bot has gone quiet. It reports whether
 * each integration is configured and never what it is configured with - the
 * endpoint behind it returns booleans only.
 *
 * The bot pause is deliberately read-only here. `isBotPaused()` reads
 * `WHATSAPP_BOT_PAUSED` from the environment on every request, so a switch in
 * this UI would need the flag persisted and that function taught to read it -
 * a behaviour change to a production-critical path, on a bot that is currently
 * paused in production. That belongs in its own reviewed commit, not folded
 * into a UI rebuild. What this page does instead is make the state visible and
 * say exactly how to change it, which is the part that was missing.
 */
export default function SettingsPage() {
  const { data: session } = useSession()
  const [health, setHealth] = useState<Health | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/settings/health')
      .then(({ data }) => setHealth(data))
      .catch(() => setHealth(null))
      .finally(() => setLoading(false))
  }, [])

  const connections: Fact[] = health
    ? [
        { term: 'WAHA', value: <Wired on={health.waha} note="WhatsApp HTTP API" /> },
        { term: 'Webhook', value: <Wired on={health.whatsappWebhook} note="נכשל סגור ללא סוד" /> },
        { term: 'מספר בעלים', value: <Wired on={health.ownerPhone} /> },
        { term: 'GitHub', value: <Wired on={health.github} note="קריאה בלבד" /> },
        { term: 'לידים מהאתר', value: <Wired on={health.publicLeads} /> },
        { term: 'Ollama', value: <Wired on={health.ollama} note="שכבת גיבוי" /> },
      ]
    : []

  const account: Fact[] = [
    { term: 'שם', value: session?.user?.name ?? '—' },
    { term: 'אימייל', value: <bdi dir="ltr">{session?.user?.email ?? '—'}</bdi> },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="הגדרות" />

      <Tabs defaultValue="bot" className="flex flex-col gap-3">
        <TabsList className="w-max">
          <TabsTrigger value="bot">הבוט</TabsTrigger>
          <TabsTrigger value="connections">חיבורים</TabsTrigger>
          <TabsTrigger value="account">חשבון</TabsTrigger>
        </TabsList>

        <TabsContent value="bot" className="m-0 flex max-w-2xl flex-col gap-3">
          {loading ? (
            <Skeleton className="h-32" />
          ) : (
            <TonePanel
              tone={health?.botPaused ? 'caution' : 'success'}
              title={health?.botPaused ? 'הבוט מושהה' : 'הבוט פעיל'}
            >
              <p>
                {health?.botPaused
                  ? 'הבוט לא מדבר עם לקוחות. הודעה שנכנסת מגיעה לוואטסאפ ולא לשום מקום אחר - בלי תשובה, בלי תיוק, ובלי פנייה שנוצרת ממנה.'
                  : 'הבוט עונה ללקוחות, מתייק פניות ושולח תזכורות.'}
              </p>
              <p className="mt-2 text-content-subtle">
                גם כשהוא מושהה, הסוכן שלך והבריף הבוקרי ממשיכים לעבוד. השהיה של הבוט
                אינה ניתוק הקו שלך אל המערכת.
              </p>
            </TonePanel>
          )}

          <div className="rounded-lg border bg-card p-4 text-ui-sm">
            <h2 className="mb-2 font-semibold text-content-strong">איך משנים</h2>
            <p className="text-content-body">
              המצב נקרא ממשתנה הסביבה <code className="font-mono">WHATSAPP_BOT_PAUSED</code> בכל
              בקשה. להשהות - להגדיר אותו לכל ערך; להפעיל מחדש - להסיר אותו. שני הכיוונים
              דורשים דיפלוי.
            </p>
            <p className="mt-2 text-content-subtle">
              המתג הזה לא נמצא כאן בכוונה: כדי להפוך אותו לכפתור צריך לשמור את הדגל
              בבסיס הנתונים ולשנות את הנתיב שמכריע אם לענות ללקוח. זה שינוי התנהגות
              בקוד קריטי, והוא ראוי לקומיט משלו.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="connections" className="m-0 max-w-2xl">
          {loading ? (
            <Skeleton className="h-56" />
          ) : health ? (
            <FactRail facts={connections} />
          ) : (
            <TonePanel tone="danger" title="לא הצלחנו לקרוא את מצב החיבורים" />
          )}
          <p className="mt-2 text-ui-2xs text-content-faint">
            מוצג רק אם מוגדר, אף פעם לא מה מוגדר.
          </p>
        </TabsContent>

        <TabsContent value="account" className="m-0 max-w-2xl">
          <FactRail facts={account} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
