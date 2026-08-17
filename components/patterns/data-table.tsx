'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { cn } from '@/lib/utils'

/**
 * A column definition.
 *
 * `align: 'numeric'` is separate from `'end'` on purpose. End-alignment is a
 * layout choice; numeric additionally means tabular figures in the mono face,
 * which is what makes a column of prices actually line up. Encoding it here
 * rather than as a class on each cell means the intent survives a restyle -
 * previously every money column re-decided this, and the projects list simply
 * forgot, so its totals did not align.
 */
export interface Column<T> {
  /** Stable key. Emitted as `data-col`, and how tests address the cell. */
  key: string
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  align?: 'start' | 'end' | 'numeric'
  width?: string
  /**
   * Where this field goes when the table becomes cards.
   *   `primary`  the title line
   *   `trailing` the end of the title line (one status, usually)
   *   `meta`     the second line
   *   omitted    desktop only - a phone cannot show ten columns and should not try
   */
  mobile?: 'primary' | 'trailing' | 'meta'
}

const ALIGN: Record<NonNullable<Column<unknown>['align']>, string> = {
  start: 'text-start',
  end: 'text-end',
  numeric: 'text-end font-mono tabular-nums',
}

/**
 * One list, two renderings, one contract.
 *
 * The desktop `<tr>` and the mobile `<article>` both emit
 * `data-slot="table-row"`, `data-testid="row"`, `data-row-id` and a `data-col`
 * per field. That is the whole trick: every e2e assertion resolves identically
 * at both viewports, so turning a 9-column table into a card list - which is
 * the only way the owner side works on a phone - costs zero spec changes.
 *
 * Rows navigate through a real `<Link>` on the primary column, so cmd-click,
 * middle-click, "copy link" and keyboard focus all work. The whole-row click is
 * a convenience on top of that, not the mechanism. The old rows were
 * `<TableRow onClick>` with no role, no tabIndex and no href - the primary
 * navigation surface of the app was mouse-only.
 */
export function DataTable<T>({
  rows,
  columns,
  getRowId,
  getRowHref,
  onRowClick,
  density = 'default',
  className,
}: {
  rows: T[]
  columns: Column<T>[]
  getRowId: (row: T) => string
  /**
   * Where the row goes. Omit only when the row genuinely has no destination -
   * and then supply `onRowClick`. Never point it at '#': a dead link is worse
   * than no link, because it looks navigable and is not.
   */
  getRowHref?: (row: T) => string
  onRowClick?: (row: T) => void
  density?: 'default' | 'compact'
  className?: string
}) {
  const router = useRouter()
  const rowHeight = density === 'compact' ? 'h-row-compact' : 'h-row'

  const activate = (row: T) => {
    const href = getRowHref?.(row)
    if (href) router.push(href)
    else onRowClick?.(row)
  }

  const primary = columns.find((c) => c.mobile === 'primary') ?? columns[0]
  const trailing = columns.filter((c) => c.mobile === 'trailing')
  const meta = columns.filter((c) => c.mobile === 'meta')

  return (
    <div className={cn('overflow-hidden rounded-lg border bg-card', className)}>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block" data-slot="table-scroll">
        <table data-slot="table" className="w-full caption-bottom">
          <thead data-slot="table-header" className="border-b bg-surface-subtle">
            <tr data-slot="table-header-row">
              {columns.map((col) => (
                <th
                  key={col.key}
                  data-slot="table-head"
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'h-8 whitespace-nowrap px-3 align-middle text-ui-2xs font-semibold text-content-subtle',
                    ALIGN[col.align ?? 'start'],
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody data-slot="table-body">
            {rows.map((row) => (
              <tr
                key={getRowId(row)}
                data-slot="table-row"
                data-testid="row"
                data-row-id={getRowId(row)}
                onClick={() => activate(row)}
                className={cn(
                  rowHeight,
                  'cursor-pointer border-b transition-colors duration-fast last:border-b-0 hover:bg-surface-subtle',
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    data-col={col.key}
                    className={cn(
                      'whitespace-nowrap px-3 align-middle text-ui-sm text-content-body',
                      ALIGN[col.align ?? 'start'],
                    )}
                  >
                    {col.key === primary.key ? (
                      getRowHref ? (
                        <Link
                          href={getRowHref(row)}
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-sm font-medium text-content-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {col.cell(row)}
                        </Link>
                      ) : (
                        <span className="font-medium text-content-strong">{col.cell(row)}</span>
                      )
                    ) : (
                      col.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: same handles, different element. */}
      <div className="divide-y md:hidden">
        {rows.map((row) => (
          <article
            key={getRowId(row)}
            data-slot="table-row"
            data-testid="row"
            data-row-id={getRowId(row)}
            onClick={() => !getRowHref && activate(row)}
            className="flex flex-col gap-1.5 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              {getRowHref ? (
                <Link
                  href={getRowHref(row)}
                  data-col={primary.key}
                  className="min-w-0 flex-1 truncate rounded-sm text-ui-sm font-semibold text-content-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {primary.cell(row)}
                </Link>
              ) : (
                <button
                  type="button"
                  data-col={primary.key}
                  onClick={() => activate(row)}
                  className="min-w-0 flex-1 truncate rounded-sm text-start text-ui-sm font-semibold text-content-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {primary.cell(row)}
                </button>
              )}
              {trailing.map((col) => (
                <span key={col.key} data-col={col.key} className="shrink-0">
                  {col.cell(row)}
                </span>
              ))}
            </div>

            {meta.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ui-xs text-content-subtle">
                {meta.map((col, i) => (
                  <React.Fragment key={col.key}>
                    {i > 0 && <span aria-hidden className="text-content-faint">·</span>}
                    <span
                      data-col={col.key}
                      className={col.align === 'numeric' ? 'font-mono tabular-nums' : undefined}
                    >
                      {col.cell(row)}
                    </span>
                  </React.Fragment>
                ))}
              </div>
            )}

            {/* Desktop-only columns still emit their handle, so a spec written
                against one viewport keeps resolving at the other. */}
            <span className="hidden">
              {columns
                .filter((c) => !c.mobile && c.key !== primary.key)
                .map((col) => (
                  <span key={col.key} data-col={col.key}>
                    {col.cell(row)}
                  </span>
                ))}
            </span>
          </article>
        ))}
      </div>
    </div>
  )
}
