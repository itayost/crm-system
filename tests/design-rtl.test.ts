import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')

/**
 * Physical direction utilities, in an app that is entirely `dir="rtl"`.
 *
 * This is a ratchet, not a gate. A big-bang conversion is the wrong shape for
 * this problem, because two of the four obvious mappings are backwards:
 *
 *   - `ml-2` on an icon inside a Button is not `me-2`. The Button already sets
 *     `gap-2`, so the margin was a second gap. The fix is deletion.
 *   - `right-3` on the search icon means *start*, not end. The page is RTL, so
 *     a naive `right` -> `end` codemod moves the icon to the far edge and pads
 *     the wrong side, putting the text under the icon on all five list pages
 *     at once.
 *
 * So the budget only ever goes down, one phase at a time, and each conversion
 * gets looked at. New code is held to zero from the start.
 */
const PHYSICAL = new RegExp(
  [
    // margins and padding
    String.raw`\b(?:ml|mr|pl|pr)-[\w.[\]/]+`,
    // text alignment
    String.raw`\btext-(?:left|right)\b`,
    // single-side borders
    String.raw`\bborder-[lr]\b`,
    String.raw`\bborder-[lr]-`,
    // margin-left based child spacing, which reverses in RTL
    String.raw`\bspace-x-`,
    /**
     * Absolute positioning. The lookbehind is load-bearing: without it this
     * matches Radix's own animation classes - `slide-in-from-left-1/2`,
     * `data-[side=left]:slide-in-from-right-2` - which are tied to a side
     * Radix already flips for RTL, and are not layout. Roughly fifteen false
     * positives on day one, which is how a rule like this gets switched off.
     */
    String.raw`(?<![\w:[\-])(?:left|right)-[\w.[\]/]+`,
  ].join('|'),
  'g',
)

/**
 * Today's count. Lower it in the same commit that removes offenders; never
 * raise it. Phase 6 takes this to the `dir="ltr"` islands only.
 */
const BUDGET = 75

/**
 * Directories written during the rebuild. These start clean and stay clean -
 * there is no reason for a brand new primitive to contain a physical utility.
 */
const GREENFIELD = ['components/patterns']

function walk(dir: string): string[] {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  return readdirSync(abs, { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) return walk(rel)
    return entry.name.endsWith('.tsx') ? [rel] : []
  })
}

function offendersIn(files: string[]) {
  return files.flatMap((f) =>
    readFileSync(join(ROOT, f), 'utf8')
      .split('\n')
      .flatMap((line, i) =>
        (line.match(PHYSICAL) ?? []).map((hit) => `${f}:${i + 1} ${hit}`),
      ),
  )
}

describe('RTL: physical direction utilities', () => {
  it('never increases', () => {
    const files = [...walk('app'), ...walk('components')]
    expect(files.length).toBeGreaterThan(20)

    const offenders = offendersIn(files)

    expect(
      offenders.length,
      `Physical utilities went up (${offenders.length} > ${BUDGET}). Use logical ` +
        `properties (ms/me/ps/pe, text-start/end, border-s/e, gap) - or delete ` +
        `the utility, which is the right answer for an icon margin inside a ` +
        `component that already sets gap.\n\n${offenders.join('\n')}`,
    ).toBeLessThanOrEqual(BUDGET)
  })

  it('is zero in code written during the rebuild', () => {
    const offenders = offendersIn(GREENFIELD.flatMap(walk))
    expect(offenders, 'new primitives must be direction-agnostic').toEqual([])
  })

  it('does not fire on Radix animation classes', () => {
    // Guards the lookbehind above. These are the exact strings that live in
    // dialog.tsx, select.tsx and dropdown-menu.tsx.
    for (const safe of [
      'slide-in-from-left-1/2',
      'slide-out-to-left-1/2',
      'data-[side=left]:slide-in-from-right-2',
      'data-[side=right]:slide-in-from-left-2',
      'translate-x-[-50%]',
    ]) {
      expect(safe.match(PHYSICAL), `${safe} is not a layout utility`).toBeNull()
    }
  })

  it('does fire on the things it is meant to catch', () => {
    for (const bad of ['text-right', 'ml-2', 'pr-10', 'border-r-4', 'space-x-2', 'right-3']) {
      expect(bad.match(PHYSICAL), `${bad} should be flagged`).not.toBeNull()
    }
  })
})
