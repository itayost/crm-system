// SABOTAGE TEST — Phase 3c production-down runbook validation via rate-spike
// Will be reverted within ~10 minutes. Intentional throw to generate error logs.

export async function GET() {
  throw new Error('SABOTAGE_TEST_2026_04_27 — intentional error for rate-spike detector validation');
}
