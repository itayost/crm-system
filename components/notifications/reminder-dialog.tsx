'use client'

import { useState } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'

interface ReminderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityType: string
  entityId: string
  entityName: string
}

export function ReminderDialog({
  open,
  onOpenChange,
  entityType,
  entityId,
  entityName,
}: ReminderDialogProps) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!date) {
      toast.error('יש לבחור תאריך')
      return
    }

    const scheduledFor = new Date(`${date}T${time}:00`)
    if (scheduledFor <= new Date()) {
      toast.error('תאריך התזכורת חייב להיות בעתיד')
      return
    }

    setSubmitting(true)
    try {
      await api.post('/reminders', {
        entityType,
        entityId,
        title: `תזכורת מעקב: ${entityName}`,
        message: notes || 'תזכורת למעקב',
        scheduledFor: scheduledFor.toISOString(),
      })

      toast.success('תזכורת נוצרה בהצלחה')
      onOpenChange(false)
      setDate('')
      setTime('09:00')
      setNotes('')
    } catch {
      toast.error('שגיאה ביצירת תזכורת')
    } finally {
      setSubmitting(false)
    }
  }

  // Quick date shortcuts
  const setQuickDate = (daysFromNow: number) => {
    const d = new Date()
    d.setDate(d.getDate() + daysFromNow)
    setDate(d.toISOString().split('T')[0])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            תזכורת מעקב — {entityName}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Quick Shortcuts */}
          <div>
            <Label className="text-sm text-gray-600 mb-2 block">קיצורים</Label>
            <div className="flex gap-2 flex-wrap">
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate(1)}>
                מחר
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate(3)}>
                עוד 3 ימים
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setQuickDate(7)}>
                עוד שבוע
              </Button>
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reminder-date">תאריך *</Label>
              <Input
                id="reminder-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reminder-time">שעה</Label>
              <Input
                id="reminder-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="reminder-notes">הערות (אופציונלי)</Label>
            <Textarea
              id="reminder-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="למשל: להתקשר ללקוח, לשלוח הצעת מחיר..."
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'יוצר תזכורת...' : 'צור תזכורת'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
