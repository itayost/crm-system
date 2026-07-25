'use client'

import { useState } from 'react'

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

export function PublicRequestForm({ token, clientName, projects }: Props) {
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
      <div className="rounded-lg bg-green-50 p-6 text-center">
        <h2 className="text-lg font-semibold text-green-800">תודה{clientName ? `, ${clientName}` : ''}!</h2>
        <p className="mt-2 text-green-700">הפנייה נשלחה ונטפל בה בהקדם.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot — hidden from real users */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className="hidden"
        aria-hidden="true"
      />

      <div>
        <label className="mb-1 block text-sm font-medium">סוג הפנייה</label>
        <select name="type" defaultValue="BUG" className="w-full rounded border p-2">
          {TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">כותרת</label>
        <input name="title" required className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">תיאור</label>
        <textarea name="description" required rows={4} className="w-full rounded border p-2" />
      </div>

      {projects.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium">פרויקט / אתר (לא חובה)</label>
          <select name="projectId" defaultValue="" className="w-full rounded border p-2">
            <option value="">—</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium">שם מלא (לא חובה)</label>
        <input name="reporterName" className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">טלפון (לא חובה)</label>
        <input name="reporterPhone" inputMode="tel" className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">אימייל (לא חובה)</label>
        <input name="reporterEmail" type="email" className="w-full rounded border p-2" />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">צירוף קובץ / צילום מסך (לא חובה)</label>
        <input
          name="file"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          className="w-full rounded border p-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'שולח...' : 'שליחה'}
      </button>
    </form>
  )
}
