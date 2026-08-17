import Link from 'next/link'

import { prisma } from '@/lib/db/prisma'
import { Button } from '@/components/ui/button'
import { RegisterForm } from './register-form'

export const dynamic = 'force-dynamic'

/**
 * Registration, open exactly once.
 *
 * `app/api/auth/register/route.ts` has existed all along with no UI, so the
 * only way to create the first owner was to curl it. On a single-operator
 * product the right IA is not "no page" but "a page that closes itself": the
 * form renders while there are no users, and afterwards this route politely
 * says so rather than offering a signup nobody should complete.
 *
 * The gate is cosmetic on its own - the API is the real boundary - but it is
 * the honest thing to show, and it stops the route being a puzzle.
 */
export default async function RegisterPage() {
  const owners = await prisma.user.count()

  if (owners > 0) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface-app p-6" dir="rtl">
        <div className="flex w-full max-w-sm flex-col items-center gap-3 rounded-lg border bg-card p-8 text-center">
          <h1 className="text-ui-lg font-semibold text-content-strong">ההרשמה סגורה</h1>
          <p className="text-ui-sm text-content-subtle">
            למערכת הזו יש בעלים. אם זה אתה, פשוט התחבר.
          </p>
          <Button asChild size="sm">
            <Link href="/login">להתחברות</Link>
          </Button>
        </div>
      </div>
    )
  }

  return <RegisterForm />
}
