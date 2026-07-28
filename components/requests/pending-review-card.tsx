'use client'

import Link from 'next/link'
import { Check, X, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { tone, REQUEST_TYPE_TONES } from '@/lib/design/tones'
import { label, REQUEST_TYPE_LABELS } from '@/lib/design/labels'
import { IntakeDetails } from './intake-details'
import { AttachmentLinks } from './attachment-links'
import { SourceBadge, AiBadge } from './request-badges'
import type { RequestRecord } from '@/lib/types/request'

/**
 * The queue of AI-drafted tickets waiting for Itay's judgment. Approving is the
 * consequential action - it creates the task and messages the client - which is
 * why this card exists apart from the plain table.
 */
export function PendingReviewCard({
  pending,
  actingOn,
  onAction,
  onOpenAttachment,
}: {
  pending: RequestRecord[]
  actingOn: string | null
  onAction: (id: string, action: 'approve' | 'dismiss') => void
  onOpenAttachment: (id: string, path: string) => void
}) {
  if (pending.length === 0) return null

  return (
    <Card className="border-amber-300 bg-amber-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-900">
          <Sparkles className="w-5 h-5" />
          ממתין לאישור ({pending.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {pending.map((request) => (
            <div
              key={request.id}
              className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-white"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={tone(REQUEST_TYPE_TONES, request.type)} variant="secondary">
                    {label(REQUEST_TYPE_LABELS, request.type)}
                  </Badge>
                  <SourceBadge source={request.source} />
                  <AiBadge
                    isAiGenerated={request.isAiGenerated}
                    aiConfidence={request.aiConfidence}
                    aiNote={request.aiNote}
                  />
                  <Link
                    href={`/requests/${request.id}`}
                    className="text-sm font-medium hover:underline"
                  >
                    {request.title}
                  </Link>
                  <AttachmentLinks
                    attachments={request.attachments}
                    onOpen={(path) => onOpenAttachment(request.id, path)}
                  />
                </div>
                <p className="text-xs text-content-subtle mt-1">
                  {request.client?.name ?? '-'}
                  {request.aiNote ? ` · ${request.aiNote}` : ''}
                </p>
                <IntakeDetails intake={request.intake} />
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  disabled={actingOn === request.id}
                  onClick={() => onAction(request.id, 'approve')}
                >
                  <Check className="w-4 h-4 ml-1" />
                  אשר
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={actingOn === request.id}
                  onClick={() => onAction(request.id, 'dismiss')}
                >
                  <X className="w-4 h-4 ml-1" />
                  דחה
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
