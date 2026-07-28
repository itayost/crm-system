'use client'

import { useState, useEffect } from 'react'
import { CalendarClock } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toneClass } from '@/lib/design/tones'

/**
 * The one thing owed to this lead next, and when.
 *
 * This used to live only in Itay's head, so the morning brief had to guess
 * from lastContactedAt - which the WhatsApp webhooks write and a phone call
 * does not, meaning a lead he rang yesterday looked abandoned and a lead with
 * a meeting booked for Thursday got nagged about on Tuesday.
 */
function toDateInputValue(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toISOString().split('T')[0]
  } catch {
    return ''
  }
}

/** Compared against the start of today, so "due today" is not overdue. */
function isOverdue(iso: string | null): boolean {
  if (!iso) return false
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return new Date(iso) < start
}

export function NextActionEditor({
  contactId,
  nextActionAt,
  nextActionNote,
  onChanged,
}: {
  contactId: string
  nextActionAt: string | null
  nextActionNote: string | null
  onChanged: () => void
}) {
  const [date, setDate] = useState(() => toDateInputValue(nextActionAt))
  const [note, setNote] = useState(nextActionNote ?? '')
  const [saving, setSaving] = useState(false)

  // The parent refetches after every save, so the props are the source of
  // truth; without this the inputs keep showing the pre-save text.
  useEffect(() => {
    setDate(toDateInputValue(nextActionAt))
    setNote(nextActionNote ?? '')
  }, [nextActionAt, nextActionNote])

  const save = async (payload: { nextActionAt: string | null; nextActionNote: string | null }) => {
    setSaving(true)
    try {
      await api.put(`/contacts/${contactId}`, payload)
      toast.success(payload.nextActionAt ? 'פעולה הבאה נשמרה' : 'פעולה הבאה נוקתה')
      onChanged()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירת פעולה הבאה')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = () => {
    if (!date) {
      toast.error('בחר תאריך לפעולה הבאה')
      return
    }
    save({
      nextActionAt: new Date(date).toISOString(),
      nextActionNote: note.trim() || null,
    })
  }

  const overdue = isOverdue(nextActionAt)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <CalendarClock className="w-5 h-5 text-content-faint" />
          פעולה הבאה
        </CardTitle>
        {overdue && (
          <span className={`text-xs px-2 py-1 rounded ${toneClass.danger}`}>באיחור</span>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-[auto_1fr_auto] gap-3 items-center">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-auto"
            aria-label="תאריך פעולה הבאה"
          />
          <Input
            placeholder="מה צריך לעשות? לדוגמה: לשלוח הצעת מחיר"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            aria-label="תיאור פעולה הבאה"
          />
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving}>
              שמירה
            </Button>
            {nextActionAt && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => save({ nextActionAt: null, nextActionNote: null })}
              >
                נקה
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
