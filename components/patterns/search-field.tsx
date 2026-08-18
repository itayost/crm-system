'use client'

import * as React from 'react'
import { Search } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

/**
 * The list search box.
 *
 * Five byte-identical copies of this existed, each positioning the icon with
 * `absolute right-3` and padding the input with `pr-10`. Those look like
 * "end-aligned" but mean the opposite: the app is RTL, so physical right is the
 * *leading* edge. A find-and-replace of `right` to `end` would have moved the
 * icon to the far side and padded the wrong one, running the text underneath it
 * on every list page simultaneously. Expressed logically here, once.
 */
export function SearchField({
  value,
  onChange,
  placeholder = 'חיפוש...',
  className,
  ...props
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
} & Omit<React.ComponentPropsWithoutRef<typeof Input>, 'value' | 'onChange'>) {
  return (
    <div className={cn('relative min-w-48 max-w-md flex-1', className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-content-faint"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-control ps-9 text-ui-sm"
        {...props}
      />
    </div>
  )
}
