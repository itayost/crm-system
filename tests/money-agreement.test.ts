import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..')

/**
 * The nav badge and the page it points at must answer the same question.
 *
 * They did not: /money listed an unpaid advance as collectable while the
 * `כספים` badge counted only phases, so the badge said nothing next to a page
 * reading ₪3,000. Two services, two definitions of "outstanding", one of them
 * wrong depending on which screen you were looking at.
 *
 * This is a structural guard rather than a behavioural one - the services need
 * a database - but it fails loudly if someone drops the advance term from
 * either side, which is the specific regression that already happened once.
 */
describe('outstanding is defined once', () => {
  const today = readFileSync(join(ROOT, 'lib/services/today.service.ts'), 'utf8')
  const money = readFileSync(join(ROOT, 'lib/services/money.service.ts'), 'utf8')

  // A third test here used to grep project-money.ts's source text for the
  // literal "narrower than owner-wide" predicate; that literal is gone now
  // that projectOutstanding defers to the ledger's state machine, and the
  // intent lives on as behaviour instead - see money-ledger.test.ts and the
  // 18 assertions in project-money.test.ts.

  it('counts unpaid approved phases on both sides', () => {
    expect(today).toContain("status: 'APPROVED'")
    expect(today).toContain('paidAt: null')
    expect(money).toContain("r.status === 'APPROVED' && !r.paidAt")
  })

  it('counts unpaid advances on both sides', () => {
    // TodayService queries them directly; MoneyService folds them in as
    // synthetic rows carrying APPROVED, which the `due` filter then picks up.
    expect(today).toContain('advancePaidAt: null')
    expect(today).toContain('advanceAmount')
    expect(money).toContain("kind: 'advance'")
    expect(money).toContain('advancePaidAt')
  })
})
