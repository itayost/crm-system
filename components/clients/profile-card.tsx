'use client'

import { useState, useEffect } from 'react'
import { BookOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * The client profile the support bot reads - and may therefore say out loud.
 * Deliberately a separate field from הערות: everything here can reach the
 * client's ears, so the editor says exactly that. The מילון section is the one
 * the bot appends to itself when a clarification resolves a client's term.
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

  // The bot may have added a glossary line since the page loaded.
  useEffect(() => {
    setValue(profileHe ?? '')
  }, [profileHe])

  const save = async () => {
    setSaving(true)
    try {
      await api.put(`/clients/${clientId}`, { profileHe: value.trim() || null })
      toast.success('פרופיל הבוט נשמר')
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
          פרופיל לבוט התמיכה
        </CardTitle>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? 'שומר...' : 'שמירה'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-content-subtle">
          כל מה שכתוב כאן גלוי לבוט — והוא עשוי להגיד את זה ללקוח. דברים פרטיים שייכים
          להערות, לא לכאן. הבוט מוסיף בעצמו שורות למקטע &quot;מילון מונחים&quot;.
        </p>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={8}
          maxLength={4000}
          placeholder={'## מוצר וסביבה\n\n## מילון מונחים\n- המונח של הלקוח ← המסך שהכוונה אליו\n\n## נושאים חוזרים\n\n## העדפות'}
          className="font-mono text-sm"
          dir="rtl"
        />
      </CardContent>
    </Card>
  )
}
