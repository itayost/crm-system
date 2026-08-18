'use client'

import { useId, useRef, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, Paperclip, X } from 'lucide-react'

import { PortalButton, portalButton } from '@/components/portal/portal-button'
import {
  ALLOWED_MIME,
  ATTACHMENT_MAX_BYTES,
  MAX_ATTACHMENTS,
} from '@/lib/services/storage.service'
import { cn } from '@/lib/utils'

interface ProjectOption {
  id: string
  name: string
}

const TYPES = [
  { value: 'BUG', label: 'תקלה' },
  { value: 'REQUEST', label: 'בקשה' },
  { value: 'QUESTION', label: 'שאלה' },
  { value: 'OTHER', label: 'אחר' },
]

const ACCEPT = ALLOWED_MIME.join(',')

/**
 * The one form a paying customer ever fills in.
 *
 * Off the home page and onto its own route, because it was the main body of the
 * first screen a client saw - six fields and a file input above anything about
 * their actual work.
 *
 * Two things changed beyond the move. The type is chips rather than a <select>,
 * since it is four mutually exclusive options and a native select on a phone is
 * a modal wheel for something that fits on one line. And the file control is a
 * real one: it accepted a single file and rendered "No file chosen" - English,
 * on a Hebrew RTL page, in the one form a paying customer ever fills in.
 *
 * Still uncontrolled FormData with no validation library. This is a public page
 * and the server validates everything again regardless; the client-side work
 * here is limited to what the browser cannot do on its own.
 */
export function NewRequestForm({
  token,
  clientName,
  projects,
}: {
  token: string
  clientName: string
  projects: ProjectOption[]
}) {
  const id = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return
    const next: File[] = []
    for (const file of Array.from(incoming)) {
      if (!ALLOWED_MIME.includes(file.type)) {
        setError('אפשר לצרף תמונות (PNG, JPG, WEBP) או PDF בלבד.')
        continue
      }
      if (file.size > ATTACHMENT_MAX_BYTES) {
        setError(`הקובץ ${file.name} גדול מדי (מקסימום 5MB).`)
        continue
      }
      next.push(file)
    }
    if (next.length === 0) return
    setError(null)
    setFiles((current) => [...current, ...next].slice(0, MAX_ATTACHMENTS))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('token', token)
      // The <input type="file"> is not the source of truth - files can arrive
      // by drop or paste too - so its own entries are replaced wholesale.
      formData.delete('file')
      for (const file of files) formData.append('file', file)

      const res = await fetch('/api/public/requests', { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok || !body.success) throw new Error(body.error || 'שגיאה בשליחת הטופס')
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת הטופס')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-tone-success-mark/40 bg-tone-success-surface/40 p-7 text-center">
        <CheckCircle2 aria-hidden className="size-7 text-tone-success-mark" />
        <p className="font-display text-portal-title font-medium text-content-strong">תודה!</p>
        {/* Says what happens next and roughly when, because "we will get back to
            you" with no timeframe is the sentence that generates the follow-up
            WhatsApp message this form exists to avoid. */}
        <p className="text-portal-sm text-content-body">
          {clientName ? `${clientName}, הפנייה התקבלה.` : 'הפנייה התקבלה.'} נעבור עליה ונחזור אליך
          בוואטסאפ, בדרך כלל באותו יום.
        </p>
        <Link href={`/r/${token}/requests`} className={portalButton('quiet', 'mt-1')}>
          לפניות שלך
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {/* Honeypot - hidden from real users. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-portal-xs font-semibold text-content-strong">
          סוג הפנייה
        </legend>
        <div className="flex flex-wrap gap-2">
          {TYPES.map((type, i) => (
            <label
              key={type.value}
              className="group cursor-pointer"
              // The chip is the label; the radio itself is visually hidden but
              // still focusable, so keyboard and screen readers get a real
              // radiogroup rather than a set of divs.
            >
              <input
                type="radio"
                name="type"
                value={type.value}
                defaultChecked={i === 0}
                className="peer sr-only"
              />
              <span className="inline-flex h-11 items-center rounded-md border border-border-strong bg-card px-4 text-portal-sm font-medium text-content-body transition-colors duration-fast peer-checked:border-primary peer-checked:bg-primary peer-checked:font-semibold peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                {type.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field htmlFor={`${id}-title`} label="כותרת">
        <input
          id={`${id}-title`}
          name="title"
          required
          placeholder="במשפט אחד — מה לא עובד?"
          className={FIELD}
        />
      </Field>

      <Field htmlFor={`${id}-description`} label="תיאור">
        <textarea
          id={`${id}-description`}
          name="description"
          required
          rows={4}
          placeholder="איפה זה קרה, מה ראית, ומה ציפית שיקרה."
          className={cn(FIELD_BASE, 'resize-y py-3 leading-relaxed')}
        />
      </Field>

      <Field htmlFor={`${id}-file`} label="קבצים">
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            addFiles(e.dataTransfer.files)
          }}
          onPaste={(e) => addFiles(e.clipboardData.files)}
          className={cn(
            'flex flex-col items-center gap-1 rounded-md border border-dashed p-5 text-center transition-colors duration-fast',
            dragging ? 'border-primary bg-surface-subtle' : 'border-border-strong bg-surface-subtle',
          )}
        >
          <span className="text-portal-sm font-semibold text-content-body">
            צילום מסך עוזר מאוד
          </span>
          <span className="text-portal-xs text-content-muted">
            גררו לכאן, הדביקו מהלוח, או{' '}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-semibold text-content-strong underline underline-offset-4"
            >
              בחרו קובץ
            </button>
          </span>
          <span className="text-portal-2xs text-content-faint">
            PNG · JPG · PDF · עד <bdi className="font-mono">{MAX_ATTACHMENTS}</bdi> קבצים
          </span>
          <input
            ref={inputRef}
            id={`${id}-file`}
            name="file"
            type="file"
            multiple
            accept={ACCEPT}
            onChange={(e) => {
              addFiles(e.target.files)
              // Cleared so re-picking the same file fires change again.
              e.target.value = ''
            }}
            className="sr-only"
          />
        </div>

        {files.length > 0 && (
          <ul className="mt-2.5 flex flex-col gap-2">
            {files.map((file, i) => (
              <li
                key={`${file.name}-${i}`}
                className="flex items-center gap-3 rounded-md border bg-card p-2.5"
              >
                <Paperclip aria-hidden className="size-4 shrink-0 text-content-muted" />
                <span className="min-w-0 flex-1 truncate text-portal-xs text-content-body">
                  {file.name}
                </span>
                <span className="shrink-0 font-mono text-portal-2xs tabular-nums text-content-faint">
                  <bdi>{Math.max(1, Math.round(file.size / 1024))} KB</bdi>
                </span>
                <button
                  type="button"
                  onClick={() => setFiles((c) => c.filter((_, j) => j !== i))}
                  aria-label={`הסרת ${file.name}`}
                  className="grid size-7 shrink-0 place-items-center rounded-sm text-content-muted hover:bg-surface-subtle hover:text-content-strong"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Field>

      {projects.length > 0 && (
        <Field htmlFor={`${id}-project`} label="לאיזה אתר או פרויקט?">
          <select id={`${id}-project`} name="projectId" defaultValue="" className={FIELD}>
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      {/* Contact details are optional and almost always already known, so they
          sit behind a disclosure rather than taking three fields of the form. */}
      <details className="group rounded-md border bg-card">
        <summary className="flex h-12 cursor-pointer list-none items-center px-4 text-portal-sm font-medium text-content-body">
          פרטי קשר אחרים (לא חובה)
        </summary>
        <div className="flex flex-col gap-4 border-t p-4">
          <Field htmlFor={`${id}-name`} label="שם מלא">
            <input id={`${id}-name`} name="reporterName" className={FIELD} />
          </Field>
          <Field htmlFor={`${id}-phone`} label="טלפון">
            <input id={`${id}-phone`} name="reporterPhone" inputMode="tel" dir="ltr" className={FIELD} />
          </Field>
          <Field htmlFor={`${id}-email`} label="אימייל">
            <input id={`${id}-email`} name="reporterEmail" type="email" dir="ltr" className={FIELD} />
          </Field>
        </div>
      </details>

      {error && (
        <p role="alert" className="text-portal-xs text-tone-danger-foreground">
          {error}
        </p>
      )}

      <PortalButton type="submit" disabled={submitting} className="w-full">
        {submitting ? 'שולח…' : 'שליחה'}
      </PortalButton>
    </form>
  )
}

/**
 * Split in two on purpose. `h-control` and `h-auto` are both height utilities,
 * so which one wins is decided by Tailwind's emit order and not by the order
 * they appear in the class attribute - putting both on the textarea collapsed
 * it to 48px regardless of `rows`.
 */
const FIELD_BASE =
  'w-full rounded-md border border-border-strong bg-card px-3.5 text-portal-base text-content-body ' +
  'placeholder:text-content-faint focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-surface-app'

const FIELD = `h-control ${FIELD_BASE}`

function Field({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-portal-xs font-semibold text-content-strong">
        {label}
      </label>
      {children}
    </div>
  )
}
