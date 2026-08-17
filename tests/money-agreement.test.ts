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

  it('keeps projectOutstanding narrower on purpose', () => {
    // The per-project helper answers "work signed off but not yet paid for",
    // which excludes advances by design. If that ever changes, the comment in
    // today.service.ts explaining the difference is now a lie.
    const helper = readFileSync(join(ROOT, 'lib/utils/project-money.ts'), 'utf8')
    expect(helper).toContain("p.status === 'APPROVED' && !p.paidAt")
    expect(helper).not.toContain('advancePaidAt ? amount(advance) : 0\n  return advancePart + sum(phases.filter((p) => p.status')
  })
})
