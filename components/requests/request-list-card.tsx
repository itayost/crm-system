'use client'

import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { tone, REQUEST_STATUS_TONES } from '@/lib/design/tones'
import { label, REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from '@/lib/design/labels'
import { SourceBadge, AiBadge } from './request-badges'
import type { RequestRecord } from '@/lib/types/request'

/**
 * The פניות a client or a project has. Lifted out of the client page so the
 * project page could show the same thing rather than grow a second copy that
 * drifts.
 *
 * `action` is a slot rather than a boolean: the client page puts its "פניה
 * חדשה" button there, and the project page passes nothing, because RequestForm
 * has no defaultProjectId to open it with.
 */
export type RequestListItem = Pick<
  RequestRecord,
  'id' | 'title' | 'type' | 'status' | 'source' | 'isAiGenerated' | 'aiConfidence' | 'aiNote'
>

export function RequestListCard({
  requests,
  action,
  emptyText = 'אין פניות עדיין',
}: {
  requests: RequestListItem[]
  action?: ReactNode
  emptyText?: string
}) {
  const router = useRouter()

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Inbox className="w-5 h-5 text-content-faint" />
          פניות
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-sm text-content-subtle text-center py-6">{emptyText}</p>
        ) : (
          <div className="space-y-3">
            {requests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-surface-subtle cursor-pointer transition-colors"
                onClick={() => router.push(`/requests/${request.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    router.push(`/requests/${request.id}`)
                  }
                }}
              >
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-sm font-medium">{request.title}</span>
                  <span className="text-xs text-content-subtle">
                    {label(REQUEST_TYPE_LABELS, request.type)}
                  </span>
                  <SourceBadge source={request.source} />
                  <AiBadge
                    isAiGenerated={request.isAiGenerated}
                    aiConfidence={request.aiConfidence}
                    aiNote={request.aiNote}
                  />
                </div>
                <Badge className={tone(REQUEST_STATUS_TONES, request.status)} variant="secondary">
                  {label(REQUEST_STATUS_LABELS, request.status)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
