// SABOTAGE TEST — Phase 3c4 production-down runbook validation (round 2)
// Will be reverted within ~10 minutes.

export async function GET() {
  throw new Error('SABOTAGE_TEST_2026_04_27_PHASE_3C4_ROUND_2 — intentional error for runbook validation');
}
