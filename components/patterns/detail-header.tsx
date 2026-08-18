'use client'

import * as React from 'react'
import Link from 'next/link'
import { ChevronRight, MoreHorizontal } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * The header of every detail page: where you came from, what this is, and the
 * single next thing to do with it.
 *
 * One primary action, and destructive lives behind `⋯`. Every detail page used
 * to show `[עריכה][מחיקה]` as a pair in the header, with delete rendered
 * `destructive` at the same weight as edit - a red button on every page in the
 * product, which trains you to stop seeing red exactly when it matters.
 *
 * The back chevron points right because that is "backwards" in an RTL reading
 * order.
 */
export function DetailHeader({
  backHref,
  breadcrumb,
  title,
  pills,
  primaryAction,
  menu,
  className,
}: {
  backHref: string
  breadcrumb: React.ReactNode
  title: React.ReactNode
  /** At most three identity pills. More than that and none of them reads. */
  pills?: React.ReactNode
  primaryAction?: React.ReactNode
  /** Secondary and destructive actions, rendered inside the ⋯ menu. */
  menu?: React.ReactNode
  className?: string
}) {
  return (
    <div
      data-slot="detail-header"
      className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}
    >
      <Link
        href={backHref}
        aria-label="חזרה"
        className="rounded-md p-1 text-content-faint transition-colors duration-fast hover:text-content-strong focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight aria-hidden className="size-4" />
      </Link>

      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-ui-xs text-content-subtle">{breadcrumb}</span>
        <h1 className="truncate text-ui-lg font-semibold text-content-strong">{title}</h1>
        {pills}
      </div>

      <div className="ms-auto flex items-center gap-2">
        {primaryAction}
        {menu && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-7" aria-label="פעולות נוספות">
                <MoreHorizontal aria-hidden className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {menu}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )
}
