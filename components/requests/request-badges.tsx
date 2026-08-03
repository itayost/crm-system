import { FileText, HelpCircle, Mail, MessageCircle, Sparkles, type LucideIcon } from 'lucide-react'

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

/**
 * AI provenance, in one treatment rather than the three this app grew: a violet
 * icon on the list, a green/yellow badge on the detail page, and a plain icon
 * on the review card.
 *
 * The confidence the filing service writes is a two-value signal - 1 means the
 * client confirmed the summary, anything less means the ticket was filed
 * without an answer - and that distinction is the first thing to check when
 * reviewing. So the unconfirmed case is the one that gets weight.
 */
export function AiBadge({
  isAiGenerated,
  aiConfidence,
  aiNote,
}: {
  isAiGenerated: boolean
  aiConfidence?: number | null
  aiNote?: string | null
}) {
  if (!isAiGenerated) return null

  const confirmed = (aiConfidence ?? 0) >= 1

  return (
    <StatusPill
      tone={confirmed ? 'accent' : 'caution'}
      emphasis={confirmed ? 'quiet' : 'soft'}
      title={aiNote ?? undefined}
    >
      <Sparkles aria-hidden className="w-3 h-3 shrink-0" />
      {confirmed ? 'AI · אושר ע״י הלקוח' : 'AI · לא מאושר'}
    </StatusPill>
  )
}

/**
 * The compact AI mark for table rows, where the full badge would not fit.
 * Same tone as the badge, so the two read as the same thing.
 */
export function AiMark({ isAiGenerated }: { isAiGenerated: boolean }) {
  if (!isAiGenerated) return null

  return (
    <Sparkles
      role="img"
      aria-label="נוצר על ידי AI"
      className="w-3.5 h-3.5 shrink-0 text-content-subtle"
    />
  )
}
