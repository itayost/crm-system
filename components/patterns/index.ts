/**
 * The page-composition layer.
 *
 * This repo had a real design-token layer (globals.css, lib/design/*) and a
 * real primitive layer (components/ui/*) with nothing in between, so every page
 * re-typed its own chrome. The measured cost: the page header written 7 times,
 * the search box 5, the table wrapper 5, the loading skeleton 5, empty states
 * 15, the delete dialog 5, `<TableHead className="text-right">` 30+ times.
 *
 * Everything here is direction-agnostic - `tests/design-rtl.test.ts` holds this
 * directory to zero physical utilities.
 */

export { PageHeader } from './page-header'
export { SearchField } from './search-field'
export { EmptyState } from './empty-state'
export { TableSkeleton } from './table-skeleton'
export { DataTable, type Column } from './data-table'
export { SegmentControl, type Segment } from './segment-control'
export { PhaseStrip } from './phase-strip'
export { Figure, MoneyLine } from './money-line'
export { FactRail, type Fact } from './fact-rail'
export { TonePanel } from './tone-panel'
export { DetailHeader } from './detail-header'
export { ConfirmDelete } from './confirm-delete'
