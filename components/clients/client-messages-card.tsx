'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import api from '@/lib/api/client'
import { formatDate } from '@/lib/utils'

interface Message {
  id: string
  body: string | null
  transcript: string | null
  direction: string
  timestamp: string
  contact: { id: string; name: string } | null
}

/**
 * The WhatsApp traffic behind this client, newest last.
 *
 * Replaces a card that said "יתווסף בקרוב" and fetched nothing. The service
 * method it reads has existed unused since that stub was written.
 *
 * Loaded on demand rather than with the page: it is up to 200 rows and is not
 * what you open a client for, so it should not slow down the numbers that are.
 */
export function ClientMessagesCard({ clientId }: { clientId: string }) {
  const [messages, setMessages] = useState<Message[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [opened, setOpened] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.get(`/clients/${clientId}/messages?days=30`)
      setMessages(response.data)
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [clientId])

  useEffect(() => {
    if (opened && messages === null) load()
  }, [opened, messages, load])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>שיחות ב-30 הימים האחרונים</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => setOpened((v) => !v)}>
          {opened ? 'הסתר' : 'הצג'}
        </Button>
      </CardHeader>

      {opened && (
        <CardContent>
          {loading && <Skeleton className="h-24 w-full" />}

          {!loading && messages?.length === 0 && (
            <p className="text-sm text-content-subtle">
              אין הודעות מהחודש האחרון. הודעות נאספות מהמספר האישי ומהבוט.
            </p>
          )}

          {!loading && messages && messages.length > 0 && (
            <ul className="space-y-2">
              {messages.map((message) => {
                // A voice note has no body; the transcript is the only text.
                const text = message.body?.trim() || message.transcript?.trim() || '[מדיה]'
                const incoming = message.direction === 'INCOMING'

                return (
                  <li
                    key={message.id}
                    className={
                      incoming
                        ? 'rounded-lg border border-border p-3'
                        : 'rounded-lg border border-tone-info-mark/30 bg-tone-info-surface/30 p-3'
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs text-content-faint">
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" />
                        {incoming ? (message.contact?.name ?? 'הלקוח') : 'איתי'}
                      </span>
                      <bdi>{formatDate(message.timestamp)}</bdi>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-content-body">{text}</p>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      )}
    </Card>
  )
}
