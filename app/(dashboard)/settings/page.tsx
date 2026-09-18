'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

import api from '@/lib/api/client'
import { StatusPill } from '@/components/ui/status-pill'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader, FactRail, TonePanel, type Fact } from '@/components/patterns'

interface Health {
  waha: boolean
  ownerPhone: boolean
  publicLeads: boolean
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
 * חיבורים reports whether each integration is configured and never what it is
 * configured with - the endpoint behind it returns booleans only.
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
        { term: 'מספר בעלים', value: <Wired on={health.ownerPhone} /> },
        { term: 'לידים מהאתר', value: <Wired on={health.publicLeads} /> },
      ]
    : []

  const account: Fact[] = [
    { term: 'שם', value: session?.user?.name ?? '—' },
    { term: 'אימייל', value: <bdi dir="ltr">{session?.user?.email ?? '—'}</bdi> },
  ]

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="הגדרות" />

      <Tabs defaultValue="connections" className="flex flex-col gap-3">
        <TabsList className="w-max">
          <TabsTrigger value="connections">חיבורים</TabsTrigger>
          <TabsTrigger value="account">חשבון</TabsTrigger>
        </TabsList>

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
