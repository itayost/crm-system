import { describe, expect, it } from 'vitest'
import {
  EMPTY_INTAKE,
  intakeKind,
  mergeIntake,
  missingIntakeFields,
  readIntake,
} from '@/lib/validations/intake'

describe('which questions apply', () => {
  it('treats an undecided request as something broken', () => {
    expect(intakeKind(EMPTY_INTAKE)).toBe('broken')
    expect(intakeKind({ ...EMPTY_INTAKE, suggestedType: 'BUG' })).toBe('broken')
  })

  it('treats a wanted change as a change', () => {
    expect(intakeKind({ ...EMPTY_INTAKE, suggestedType: 'IMPROVEMENT' })).toBe('change')
    expect(intakeKind({ ...EMPTY_INTAKE, suggestedType: 'REQUEST' })).toBe('change')
  })

  it('asks nothing for a plain question', () => {
    const intake = { ...EMPTY_INTAKE, suggestedType: 'QUESTION' as const }

    expect(intakeKind(intake)).toBe('question')
    expect(missingIntakeFields(intake)).toEqual([])
  })
})

describe('what is still missing', () => {
  it('names the empty required fields for something broken', () => {
    expect(missingIntakeFields(EMPTY_INTAKE)).toEqual(['where', 'whatHappened', 'expected'])
  })

  it('asks for nothing once the client has said it all', () => {
    const intake = {
      ...EMPTY_INTAKE,
      suggestedType: 'BUG' as const,
      where: 'עמוד הבית',
      whatHappened: 'התמונה יוצאת מהמסגרת',
      expected: 'שתישאר בתוך המסגרת',
    }

    expect(missingIntakeFields(intake)).toEqual([])
  })

  it('never treats frequency or workedBefore as required', () => {
    const intake = {
      ...EMPTY_INTAKE,
      where: 'עמוד הבית',
      whatHappened: 'שבור',
      expected: 'שיעבוד',
    }

    // These are worth asking sometimes, never worth blocking a summary on.
    expect(missingIntakeFields(intake)).not.toContain('frequency')
    expect(missingIntakeFields(intake)).not.toContain('workedBefore')
  })

  it('skips "where" for a consultation, which has no screens', () => {
    expect(missingIntakeFields(EMPTY_INTAKE, { skipWhere: true })).toEqual([
      'whatHappened',
      'expected',
    ])
  })

  it('asks a change request what it is for, not how often it happens', () => {
    const intake = { ...EMPTY_INTAKE, suggestedType: 'IMPROVEMENT' as const }

    expect(missingIntakeFields(intake)).toEqual(['goal', 'today'])
  })
})

describe('merging what later messages add', () => {
  it('fills gaps without overwriting what is already known', () => {
    const base = { ...EMPTY_INTAKE, where: 'עמוד הבית', whatHappened: 'שבור' }

    const merged = mergeIntake(base, {
      where: null,
      whatHappened: 'משהו אחר',
      expected: 'שיעבוד',
    })

    expect(merged.where).toBe('עמוד הבית')
    expect(merged.whatHappened).toBe('משהו אחר')
    expect(merged.expected).toBe('שיעבוד')
  })

  it('ignores a null extraction entirely', () => {
    const base = { ...EMPTY_INTAKE, where: 'עמוד הבית' }

    expect(mergeIntake(base, null)).toEqual(base)
  })
})

describe('reading stored intake', () => {
  it('falls back to empty rather than throwing on junk', () => {
    expect(readIntake(null)).toEqual(EMPTY_INTAKE)
    expect(readIntake({ where: 42 })).toEqual(EMPTY_INTAKE)
    expect(readIntake('nonsense')).toEqual(EMPTY_INTAKE)
  })

  it('reads a stored intake back', () => {
    const stored = { ...EMPTY_INTAKE, where: 'עמוד הבית', suggestedType: 'BUG' as const }

    expect(readIntake(stored)).toEqual(stored)
  })
})
