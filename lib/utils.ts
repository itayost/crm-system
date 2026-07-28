import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Both of these existed here already but nothing imported them - five pages had
 * each redeclared their own copy instead, and those copies are what is actually
 * on screen. So these now match the copies, not the other way round: changing
 * the rendering was never the point of consolidating them.
 *
 * Amounts arrive as strings when they come from a Prisma Decimal over JSON,
 * hence the wide input type.
 */
export function formatDate(date: Date | string | null | undefined) {
  if (!date) return '-'
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatCurrency(amount: number | string | null | undefined) {
  if (amount == null) return '-'
  const n = Number(amount)
  if (Number.isNaN(n)) return '-'
  return `${n.toLocaleString()} ₪`
}

export function formatTime(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}:${mins.toString().padStart(2, '0')}`
}