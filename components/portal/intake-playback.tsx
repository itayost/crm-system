import type { ClientIntakeAnswer } from '@/lib/services/client-view'

/**
 * What the support agent understood, shown to the person who said it.
 *
 * The bot asks a client where it happened, what happened, what they expected,
 * how often and whether it is blocking them. Those answers are stored on the
 * request and were folded into a Task description for Itay - the client, who
 * supplied every one of them, never saw them again.
 *
 * Two things this buys, and the second is the reason it exists: the client can
 * see they were heard accurately, and they can catch a misunderstanding while it
 * is still cheap. A wrong "expected" here costs a sentence in WhatsApp; the same
 * wrong "expected" discovered after delivery costs the build.
 *
 * Rendered as a <dl> rather than as prose because these are answers to specific
 * questions, and reading them back as a paragraph would hide which question was
 * being answered.
 */
export function IntakePlayback({ answers }: { answers: ClientIntakeAnswer[] }) {
  if (answers.length === 0) return null

  return (
    <div className="rounded-lg bg-surface-subtle p-4">
      <dl className="flex flex-col">
        {answers.map((answer, i) => (
          <div
            key={answer.field}
            className={
              i === answers.length - 1
                ? 'grid grid-cols-[6.5rem_1fr] gap-3.5 py-2'
                : 'grid grid-cols-[6.5rem_1fr] gap-3.5 border-b border-border py-2'
            }
          >
            <dt className="text-portal-xs font-medium text-content-muted">{answer.label}</dt>
            <dd className="text-portal-sm text-content-body">{answer.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
