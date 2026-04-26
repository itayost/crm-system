// SABOTAGE TEST — Phase 3c production-down runbook validation
// Will be reverted within ~10 minutes of this commit landing.
// Intentional TypeScript error to force `next build` to fail.

export const sabotage: number = 'this is a string, not a number — TS will reject this';
