import {
  INTAKE_FIELD_LABELS,
  INTAKE_FREQUENCY_LABELS,
  type Intake,
} from '@/lib/validations/intake'
import { REQUEST_TYPE_LABELS } from '@/lib/design/labels'

/**
 * What the agent got out of the client, as a form rather than as prose. The
 * point of the whole intake: everything you need to judge a ticket, in the same
 * place on every ticket.
 */
export function IntakeDetails({ intake }: { intake?: Intake | null }) {
  if (!intake) return null

  const rows: Array<[string, string]> = []
  const add = (field: keyof Intake, value: string | null | undefined) => {
    if (value) rows.push([INTAKE_FIELD_LABELS[field], value])
  }

  add('where', intake.where)
  add('whatHappened', intake.whatHappened)
  add('expected', intake.expected)
  add('frequency', intake.frequency ? INTAKE_FREQUENCY_LABELS[intake.frequency] : null)
  if (intake.workedBefore !== null && intake.workedBefore !== undefined) {
    add('workedBefore', intake.workedBefore ? 'כן' : 'לא')
  }
  if (intake.blocking !== null && intake.blocking !== undefined) {
    add('blocking', intake.blocking ? 'כן' : 'לא')
  }
  add('goal', intake.goal)
  add('today', intake.today)

  if (rows.length === 0 && !intake.suggestedType) return null

  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.map(([label, value]) => (
        <div key={label} className="contents">
          <dt className="text-content-subtle whitespace-nowrap">{label}</dt>
          <dd className="text-content-strong">{value}</dd>
        </div>
      ))}
      {intake.suggestedType && (
        <div className="contents">
          <dt className="text-content-faint whitespace-nowrap">
            {INTAKE_FIELD_LABELS.suggestedType}
          </dt>
          <dd className="text-content-faint">
            {REQUEST_TYPE_LABELS[intake.suggestedType] ?? intake.suggestedType}
          </dd>
        </div>
      )}
    </dl>
  )
}
