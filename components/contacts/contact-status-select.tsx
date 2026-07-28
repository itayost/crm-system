'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { tone, CONTACT_STATUS_TONES } from '@/lib/design/tones'
import { label, CONTACT_STATUS_LABELS } from '@/lib/design/labels'
import { LEAD_STATUSES } from '@/lib/validations/enums'

/**
 * How a lead advances. Until this existed the only transition the product
 * offered was "המר ללקוח" - CONTACTED and QUOTED were reachable by the WhatsApp
 * agent but not by a human at a keyboard.
 *
 * CLIENT is deliberately not in the list. Converting also creates the Client
 * business record and moves the contact into it, so it stays on the dedicated
 * button where that consequence is legible.
 */
const SELECTABLE = [...LEAD_STATUSES, 'LOST'] as const

export function ContactStatusSelect({
  contactId,
  status,
  onChanged,
}: {
  contactId: string
  status: string
  onChanged: () => void
}) {
  const [saving, setSaving] = useState(false)

  const handleChange = async (next: string) => {
    if (next === status) return
    setSaving(true)
    try {
      await api.put(`/contacts/${contactId}`, { status: next })
      toast.success('סטטוס עודכן בהצלחה')
      onChanged()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בעדכון סטטוס')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Select value={status} onValueChange={handleChange} disabled={saving}>
      <SelectTrigger className="w-auto h-auto border-0 p-0 shadow-none focus:ring-0 gap-1">
        <SelectValue asChild>
          <Badge className={tone(CONTACT_STATUS_TONES, status)} variant="secondary">
            {label(CONTACT_STATUS_LABELS, status)}
          </Badge>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {SELECTABLE.map((value) => (
          <SelectItem key={value} value={value}>
            {label(CONTACT_STATUS_LABELS, value)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
