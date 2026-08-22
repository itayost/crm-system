import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db/prisma'
import { isLeadSubmissionAuthorized } from '@/lib/api/public-lead-auth'
import { checkRateLimit } from '@/lib/utils/rate-limit'
import {
  PublicLeadsService,
  type LeadOutcome,
  type LeadSubmission,
} from '@/lib/services/public-leads.service'
import { notifyOwner } from '@/lib/services/owner-line'

/**
 * Lead intake from the website.
 *
 * Server-to-server only: itayost.com holds the visitor's form, validates and
 * rate-limits it per visitor, then forwards it from its own server with the
 * shared secret. Three things stand between a stranger and this table - the
 * secret, this rate limit, and the duplicate window in PublicLeadsService.
 *
 * There is no CORS grant on purpose. A browser calling this directly would have
 * to carry the secret, and the old OPTIONS handler advertised an origin that
 * the POST reply never honoured, so a cross-origin form wrote its row and still
 * reported failure to the visitor.
 */

const israeliPhoneRegex = /^0(5[0-9]|[2-4]|7[0-9]|8|9)-?\d{7}$/

/** Generous next to real volume (a handful of leads a day), tight against a loop. */
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 60 * 1000

const publicLeadSchema = z.object({
  name: z.string({ error: 'שם חובה' }).min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')).transform(v => v === '' ? undefined : v),
  phone: z.string({ error: 'טלפון חובה' }).min(9, 'טלפון חובה').regex(israeliPhoneRegex, 'מספר טלפון ישראלי לא תקין'),
  company: z.string().optional(),
  source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']).optional(),
  estimatedBudget: z.number().optional(),
  projectType: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const caller = callerOf(req)

  if (!isLeadSubmissionAuthorized(req)) {
    // Logged, not silent: if a legitimate client form is ever locked out by a
    // missing secret, this line is how we find out which one it was.
    console.warn('[public/leads] rejected an unauthorized submission', caller)
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const limit = checkRateLimit(`lead:${caller.ip}`, RATE_LIMIT, RATE_WINDOW_MS)
  if (!limit.allowed) {
    console.warn('[public/leads] rate limited', caller)
    return NextResponse.json(
      { success: false, error: 'יותר מדי בקשות. אנא נסו שוב בעוד מספר דקות' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } }
    )
  }

  try {
    const body = await req.json()
    const data = publicLeadSchema.parse(body)

    const owner = await prisma.user.findFirst({
      where: { role: 'OWNER' },
      select: { id: true },
    })

    if (!owner) {
      return NextResponse.json({ success: false, error: 'No owner user configured' }, { status: 500 })
    }

    const { outcome, contact } = await PublicLeadsService.submit(owner.id, data)

    // A repeat of a submission Itay was already told about stays silent.
    if (outcome !== 'DUPLICATE') {
      notifyOwnerOfNewLead(contact, data, outcome).catch((err) =>
        console.error('Failed to notify owner of new lead:', err)
      )
    }

    return NextResponse.json(
      { success: true, contact },
      { status: outcome === 'CREATED' ? 201 : 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: error.issues[0]?.message ?? 'נתונים לא תקינים' },
        { status: 400 }
      )
    }
    console.error('Public lead submission error:', error)
    return NextResponse.json(
      { success: false, error: 'שגיאה בשליחת הטופס' },
      { status: 500 }
    )
  }
}

interface Caller {
  ip: string
  origin: string | null
  userAgent: string | null
}

function callerOf(req: NextRequest): Caller {
  const forwarded = req.headers.get('x-forwarded-for')

  return {
    ip: forwarded?.split(',')[0]?.trim() || 'unknown',
    origin: req.headers.get('origin') ?? req.headers.get('referer'),
    userAgent: req.headers.get('user-agent'),
  }
}

async function notifyOwnerOfNewLead(
  contact: { id: string; name: string; phone: string },
  data: LeadSubmission,
  outcome: LeadOutcome
) {
  const lines = [
    outcome === 'MERGED' ? '🔔 *טופס מהאתר מאיש קשר קיים*' : '🔔 *ליד חדש מהאתר!*',
    '',
    `*שם:* ${contact.name}`,
    `*טלפון:* ${contact.phone}`,
  ]

  if (data.email) lines.push(`*אימייל:* ${data.email}`)
  if (data.company) lines.push(`*חברה:* ${data.company}`)
  if (data.projectType) lines.push(`*סוג פרויקט:* ${data.projectType}`)
  if (data.estimatedBudget) lines.push(`*תקציב משוער:* ${data.estimatedBudget.toLocaleString()} ₪`)
  if (data.notes) {
    lines.push('')
    lines.push(`*הודעה:*`)
    lines.push(data.notes)
  }

  await notifyOwner(lines.join('\n'), { about: 'a new lead' })
}
