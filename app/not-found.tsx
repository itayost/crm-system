import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main dir="rtl" className="grid min-h-dvh place-items-center bg-surface-app p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-mono text-ui-2xl font-semibold text-content-faint">404</p>
        <h1 className="text-ui-lg font-semibold text-content-strong">הדף הזה לא קיים</h1>
        <p className="max-w-sm text-ui-sm text-content-subtle">
          ייתכן שהקישור ישן, או שהרשומה נמחקה.
        </p>
        <Button asChild size="sm">
          <Link href="/">חזרה להיום</Link>
        </Button>
      </div>
    </main>
  )
}
