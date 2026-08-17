'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'react-hot-toast'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      const result = await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirect: false,
      })
      
      if (result?.error) {
        toast.error('אימייל או סיסמה שגויים')
      } else {
        toast.success('התחברת בהצלחה!')
        // middleware.ts sets ?from= when it bounces you here, and this page
        // ignored it - so you always landed on the cockpit rather than back
        // where you were going. Same-origin paths only: `from` comes off the
        // URL, so anything absolute is an open-redirect waiting to happen.
        //
        // Resolved against the real origin rather than pattern-matched. A
        // string check is not enough: the URL parser folds a backslash into a
        // slash, so `/\evil.com` starts with a single "/" and still resolves
        // to https://evil.com - which router.push() would follow off-site.
        const from = new URLSearchParams(window.location.search).get('from')
        let safe = '/'
        if (from?.startsWith('/')) {
          const resolved = new URL(from, window.location.origin)
          if (resolved.origin === window.location.origin) {
            safe = `${resolved.pathname}${resolved.search}${resolved.hash}`
          }
        }
        router.push(safe)
        router.refresh()
      }
    } catch {
      toast.error('משהו השתבש, נסה שוב')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-app" dir="rtl">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-lg">
              CRM
            </div>
          </div>
          <CardTitle className="text-2xl text-center">התחברות למערכת</CardTitle>
          <CardDescription className="text-center">
            הזן את פרטי ההתחברות שלך כדי להיכנס למערכת
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                required
                disabled={isLoading}
                className="text-left"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              {/* No reset link: there is no password-reset flow, and the route
                  it pointed at does not exist. */}
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
                disabled={isLoading}
                className="text-left"
                dir="ltr"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  מתחבר...
                </>
              ) : (
                'התחבר'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}