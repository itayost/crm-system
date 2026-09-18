'use client'

import { useState, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Owner-maintained notes about the client, kept separate from הערות.
 * There is no bot reading this anymore - it is Itay's own reference, freeform
 * Hebrew markdown with a suggested מילון מונחים section for the client's own
 * vocabulary.
 */
export function ClientProfileCard({
  clientId,
  profileHe,
  onSaved,
}: {
  clientId: string
  profileHe: string | null
  onSaved: () => void
}) {
  const [value, setValue] = useState(profileHe ?? '')
  const [saving, setSaving] = useState(false)

  // Stay in sync if the client record was reloaded from elsewhere.
  useEffect(() => {
    setValue(profileHe ?? '')
  }, [profileHe])

  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/clients/${clientId}`, { profileHe: value.trim() || null })
      toast.success('הפרופיל נשמר')
      onSaved()
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { error?: string } } }
      toast.error(axiosError.response?.data?.error ?? 'שגיאה בשמירת הפרופיל')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-content-faint" />
          פרופיל לקוח
        </CardTitle>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'שומר...' : 'שמירה'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-content-subtle">
          הערות עבודה על הלקוח, למעקב שלך בלבד. דברים פרטיים שייכים להערות, לא
          לכאן.
        </p>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          maxLength={4000}
          placeholder={'## מוצר וסביבה\n\n## מילון מונחים\n- המונח של הלקוח ← המסך שהכוונה אליו\n\n## נושאים חוזרים\n\n## העדפות'}
          // Deliberately not `font-mono`. This field is Hebrew markdown, and
          // the mono face carries no Hebrew - every Hebrew glyph would drop to
          // an arbitrary system fallback mid-paragraph. The class was here
          // before but never took effect: a `* { font-family }` universal
          // selector in globals.css overrode it. Removing that selector is
          // what made this visible, so it is a decision now rather than an
          // accident either way. Mono stays where the content is ASCII - the
          // <kbd> in the header's help dialog, for example.
          className="text-sm"
          dir="rtl"
        />
      </CardContent>
    </Card>
  )
}
