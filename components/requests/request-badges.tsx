import { FileText, HelpCircle, Mail, MessageCircle, type LucideIcon } from 'lucide-react'

import { StatusPill } from '@/components/ui/status-pill'
import { toneOf, REQUEST_SOURCE_TONES } from '@/lib/design/tones'
import { label, REQUEST_SOURCE_LABELS } from '@/lib/design/labels'

/**
 * Where the ticket came from. A manual ticket is the unremarkable case, so by
 * default it gets no badge; the detail page opts in to showing it anyway.
 */
export function SourceBadge({
  source,
  showManual = false,
}: {
  source: string
  showManual?: boolean
}) {
  if (!source) return null
  if (source === 'MANUAL' && !showManual) return null

  return (
    <StatusPill tone={toneOf(REQUEST_SOURCE_TONES, source)} emphasis="quiet" dot>
      {label(REQUEST_SOURCE_LABELS, source)}
    </StatusPill>
  )
}

const SOURCE_ICONS: Record<string, LucideIcon> = {
  WHATSAPP: MessageCircle,
  FORM: FileText,
  EMAIL: Mail,
  OTHER: HelpCircle,
}

/**
 * Source in a table row, where a fourth pill would just be noise. MANUAL gets
 * no icon for the same reason it gets no badge: it is the ordinary case.
 *
 * This is the only thing carrying source in the list, so it is meaningful
 * non-text content - hence `content-subtle` (4.83:1) rather than the fainter
 * grey used for decoration, plus a label for screen readers.
 */
export function SourceIcon({ source }: { source: string }) {
  const Icon = SOURCE_ICONS[source]
  if (!Icon) return null

  return (
    <Icon
      role="img"
      aria-label={`מקור: ${label(REQUEST_SOURCE_LABELS, source)}`}
      className="w-3.5 h-3.5 shrink-0 text-content-subtle"
    />
  )
}
