// SABOTAGE TEST — Phase 4a feedback-loop validation
// Will be reverted within ~10 minutes.

export async function GET() {
  throw new Error('SABOTAGE_TEST_2026_04_27_PHASE_4A — feedback loop validation');
}
