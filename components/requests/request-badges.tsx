import { Badge } from '@/components/ui/badge'
import { tone, toneClass, REQUEST_SOURCE_TONES } from '@/lib/design/tones'
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
    <Badge variant="secondary" className={tone(REQUEST_SOURCE_TONES, source)}>
      {label(REQUEST_SOURCE_LABELS, source)}
    </Badge>
  )
}

/**
 * AI provenance in one badge. The confidence the filing service writes is a
 * two-value signal - 1 means the client confirmed the summary, anything less
 * means the ticket was filed without an answer - and that distinction is the
 * first thing to check when reviewing.
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
    <Badge
      variant="secondary"
      className={confirmed ? toneClass.success : toneClass.caution}
      title={aiNote ?? undefined}
    >
      {confirmed ? 'AI · אושר ע״י הלקוח' : 'AI · לא מאושר'}
    </Badge>
  )
}
