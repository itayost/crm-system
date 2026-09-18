'use client'

import { useState } from 'react'
import { PhoneCall } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

/**
 * דיברתי: one control that records the conversation and captures what is owed
 * next, because those two things are always decided in the same moment.
 *
 * Opening the dialog does not commit anything; pressing שמירה stamps
 * lastContactedAt server-side. Leaving the date empty is allowed and means
 * "spoke to them, nothing scheduled" - the stamp still lands.
 */
export function SpokeButton({
  contactId,
  nextActionAt,
  nextActionNote,
  onDone,
  variant = 'default',
}: {
  contactId: string
  nextActionAt: string | null
  nextActionNote: string | null
  onDone: () => void
  variant?: 'default' | 'row'
}) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const start = () => {
    setDate(nextActionAt ? new Date(nextActionAt).toISOString().split('T')[0] : '')
    setNote(nextActionNote ?? '')
    setOpen(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.post(`/contacts/${contactId}/spoke`, {
        nextActionAt: date ? new Date(date).toISOString() : null,
        nextActionNote: note.trim() || null,
      })
      toast.success(date ? 'נרשם, ונקבעה פעולה הבאה' : 'נרשם')
      setOpen(false)
      onDone()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירה')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant={variant === 'row' ? 'ghost' : 'outline'}
        size={variant === 'row' ? 'sm' : 'default'}
        onClick={start}
        className="gap-2"
      >
        <PhoneCall className="size-4" />
        דיברתי
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>דיברתי איתו</DialogTitle>
            <DialogDescription className="text-content-muted">
              נרשום שדיברתם עכשיו. מה צריך לעשות אחר כך?
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <Input
              placeholder="מה צריך לעשות? לדוגמה: לשלוח הצעת מחיר"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-label="תיאור פעולה הבאה"
            />
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-label="תאריך פעולה הבאה"
            />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              ביטול
            </Button>
            <Button onClick={save} disabled={saving}>
              שמירה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
