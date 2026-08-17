'use client'

import { useEffect } from 'react'
import { RotateCcw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/patterns'

/**
 * Something threw. Say so, and offer the one thing that might help.
 *
 * The previous behaviour on every detail page was to `router.push()` you back
 * to the list on any fetch failure - a transient 500 silently ejected you from
 * the page you were reading, with no message and nothing to retry.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[dashboard]', error)
  }, [error])

  return (
    <EmptyState
      kind="filtered"
      title="משהו נשבר בטעינת המסך"
      description="זה לא אתה. אפשר לנסות שוב, ואם זה חוזר - שווה להסתכל בלוג."
      action={
        <Button size="sm" onClick={reset}>
          <RotateCcw className="size-4" />
          נסה שוב
        </Button>
      }
    />
  )
}
