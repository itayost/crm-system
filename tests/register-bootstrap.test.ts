import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(__dirname, '..', 'app/api/auth/register/route.ts'),
  'utf8',
)

/**
 * The one unauthenticated path into account creation.
 *
 * It exists because the route otherwise demands a session and a session is
 * impossible until a user exists - so the whole first-run flow was a dead end
 * and the only way to stand the system up was to insert a row by hand.
 *
 * Structural assertions rather than behavioural ones: exercising the branch
 * needs a database, and what actually matters here is that three properties
 * never quietly disappear in a refactor.
 */
describe('register: the first-owner bootstrap', () => {
  it('only opens when there are no users at all', () => {
    expect(source).toContain('tx.user.count()')
    expect(source).toMatch(/if\s*\(\(await tx\.user\.count\(\)\)\s*>\s*0\)\s*return null/)
  })

  it('evaluates that gate atomically', () => {
    // Two concurrent posts would otherwise both read zero and both mint an
    // OWNER, leaving the product with two of them.
    expect(source).toContain('Prisma.TransactionIsolationLevel.Serializable')
    // A serialization failure means someone else won the race, which is the
    // same outcome as arriving second - not a 500.
    expect(source).toContain("error.code === 'P2034'")
  })

  it('forces OWNER rather than trusting the body', () => {
    // registerSchema accepts a `role`, and this path runs unauthenticated - so
    // it must not be able to mint whatever the caller asked for.
    expect(source).toMatch(/role:\s*'OWNER'/)
  })

  it('still requires a privileged session for every later user', () => {
    expect(source).toContain("session.user.role !== 'OWNER' && session.user.role !== 'ADMIN'")
  })
})
