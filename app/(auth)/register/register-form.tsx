'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { signIn } from 'next-auth/react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function RegisterForm() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)

    const form = new FormData(e.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.get('name'), email, password }),
      })
      // The route answers with `{ message }`, not `{ error }` - reading only
      // the latter turned every server-side reason ("משתמש עם אימייל זה כבר
      // קיים", "לא מורשה") into the same generic fallback.
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.message ?? body.error ?? 'שגיאה בהרשמה')

      // Straight in, rather than bouncing to a login form to retype what was
      // just typed.
      await signIn('credentials', { email, password, callbackUrl: '/' })
      router.push('/')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'שגיאה בהרשמה')
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface-app p-6" dir="rtl">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border bg-card p-8"
      >
        <div className="flex flex-col items-center gap-2">
          <span className="grid size-10 place-items-center rounded-lg bg-primary text-ui-sm font-bold text-primary-foreground">
            IO
          </span>
          <h1 className="text-ui-lg font-semibold text-content-strong">הקמת המערכת</h1>
          <p className="text-center text-ui-xs text-content-subtle">
            זה החשבון הראשון. אחריו ההרשמה נסגרת.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">שם</Label>
          <Input id="name" name="name" required autoComplete="name" className="h-10" />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">אימייל</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            className="h-10 text-start"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">סיסמה</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            dir="ltr"
            autoComplete="new-password"
            className="h-10 text-start"
          />
        </div>

        <Button type="submit" disabled={submitting} className="h-10 w-full">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? 'יוצר...' : 'יצירת החשבון'}
        </Button>
      </form>
    </div>
  )
}
