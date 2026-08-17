'use client'

import { useId, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { TonePanel } from '@/components/patterns'

interface ProjectOption {
  id: string
  name: string
}

interface Props {
  token: string
  clientName: string
  projects: ProjectOption[]
}

const TYPES = [
  { value: 'BUG', label: 'תקלה' },
  { value: 'REQUEST', label: 'בקשה' },
  { value: 'QUESTION', label: 'שאלה' },
  { value: 'OTHER', label: 'אחר' },
]

/**
 * The one form a paying customer ever fills in.
 *
 * It used none of the design system: raw `<select>` / `<input>` / `<textarea>`
 * carrying `className="w-full rounded border p-2"`, and bare `<label>` elements
 * with no `htmlFor` - so clicking a label did not focus its field and a screen
 * reader got no association at all. Native controls are kept deliberately
 * (uncontrolled FormData, no client-side validation library on a public page),
 * but they are now the app's controls, properly labelled, at 44px tap height.
 */
export function PublicRequestForm({ token, clientName, projects }: Props) {
  const id = useId()
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const formData = new FormData(e.currentTarget)
      formData.set('token', token)
      const res = await fetch('/api/public/requests', { method: 'POST', body: formData })
      const body = await res.json()
      if (!res.ok || !body.success) {
        throw new Error(body.error || 'שגיאה בשליחת הטופס')
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשליחת הטופס')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <TonePanel tone="success">
        <div className="flex flex-col items-center gap-2 py-3 text-center">
          <CheckCircle2 aria-hidden className="size-6 text-tone-success-mark" />
          <p className="text-ui-md font-semibold text-content-strong">תודה!</p>
          <p className="text-ui-sm">
            {clientName
              ? `${clientName}, הפנייה נשלחה ונטפל בה בהקדם.`
              : 'הפנייה נשלחה ונטפל בה בהקדם.'}
          </p>
        </div>
      </TonePanel>
    )
  }

  const selectClass =
    'flex h-11 w-full rounded-md border border-input bg-background px-3 text-ui-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Honeypot - hidden from real users. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-type`}>סוג הפנייה</Label>
        <select id={`${id}-type`} name="type" defaultValue="BUG" className={selectClass}>
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-title`}>כותרת</Label>
        <Input id={`${id}-title`} name="title" required className="h-11 text-ui-sm" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-description`}>תיאור</Label>
        <Textarea
          id={`${id}-description`}
          name="description"
          required
          rows={4}
          className="text-ui-sm"
          placeholder="מה קרה, ומה ציפיתם שיקרה?"
        />
      </div>

      {projects.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-project`}>פרויקט / אתר (לא חובה)</Label>
          <select id={`${id}-project`} name="projectId" defaultValue="" className={selectClass}>
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-name`}>שם מלא (לא חובה)</Label>
          <Input id={`${id}-name`} name="reporterName" className="h-11 text-ui-sm" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${id}-phone`}>טלפון (לא חובה)</Label>
          <Input
            id={`${id}-phone`}
            name="reporterPhone"
            inputMode="tel"
            dir="ltr"
            className="h-11 text-ui-sm"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-email`}>אימייל (לא חובה)</Label>
        <Input
          id={`${id}-email`}
          name="reporterEmail"
          type="email"
          dir="ltr"
          className="h-11 text-ui-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${id}-file`}>צירוף קובץ / צילום מסך (לא חובה)</Label>
        <Input
          id={`${id}-file`}
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="h-11 py-2 text-ui-sm file:me-3 file:rounded file:border-0 file:bg-surface-muted file:px-2 file:py-1 file:text-ui-xs"
        />
      </div>

      {error && (
        <p role="alert" className="text-ui-sm text-tone-danger-foreground">
          {error}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="h-11 w-full text-ui-md">
        {submitting ? 'שולח...' : 'שליחה'}
      </Button>
    </form>
  )
}
