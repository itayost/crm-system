import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  toneClass,
  toneOf,
  emphasisOf,
  type Emphasis,
  type Tone,
  AGENT_STATUS_TONES,
  CLIENT_REQUEST_STATUS_TONES,
  CLIENT_PHASE_STATUS_TONES,
  CONTACT_STATUS_TONES,
  LEDGER_STATE_TONES,
  PHASE_STATUS_TONES,
  PRIORITY_EMPHASIS,
  PRIORITY_TONES,
  PROJECT_STATUS_TONES,
  REQUEST_BILLING_TONES,
  REQUEST_SOURCE_TONES,
  REQUEST_STATUS_TONES,
  REQUEST_TYPE_TONES,
  TASK_CATEGORY_TONES,
  TASK_STATUS_TONES,
} from '@/lib/design/tones'

const ROOT = join(__dirname, '..')
const css = readFileSync(join(ROOT, 'app/globals.css'), 'utf8')

const TONES = Object.keys(toneClass) as Tone[]

const ALL_MAPS: Record<string, Record<string, Tone>> = {
  AGENT_STATUS_TONES,
  CLIENT_REQUEST_STATUS_TONES,
  CLIENT_PHASE_STATUS_TONES,
  CONTACT_STATUS_TONES,
  LEDGER_STATE_TONES,
  PHASE_STATUS_TONES,
  PRIORITY_TONES,
  PROJECT_STATUS_TONES,
  REQUEST_BILLING_TONES,
  REQUEST_SOURCE_TONES,
  REQUEST_STATUS_TONES,
  REQUEST_TYPE_TONES,
  TASK_CATEGORY_TONES,
  TASK_STATUS_TONES,
}

/** Every .tsx under `dir`, repo-relative. */
function walk(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) return walk(rel)
    return entry.name.endsWith('.tsx') ? [rel] : []
  })
}

/** Everything inside an `@layer name { ... }` block, brace-matched. */
function layeredCss(): string {
  let out = ''
  for (const open of [...css.matchAll(/@layer\s+[\w,\s]*\{/g)]) {
    let depth = 0
    for (let i = open.index!; i < css.length; i++) {
      if (css[i] === '{') depth++
      else if (css[i] === '}' && --depth === 0) {
        out += css.slice(open.index!, i + 1)
        break
      }
    }
  }
  return out
}

describe('the tone rules actually ship', () => {
  /**
   * The bug this guards: `.tone-*` lived in `@layer components`, Tailwind
   * tree-shook it against content globs that did not include `lib/`, and every
   * status badge in the product rendered grey for weeks. Nothing failed,
   * because nothing was checking that the rules existed.
   */
  it('defines every tone class outside @layer, where Tailwind cannot purge it', () => {
    for (const tone of TONES) {
      expect(css, `.${toneClass[tone]} rule is missing`).toContain(`.${toneClass[tone]}`)
    }

    expect(layeredCss(), 'a tone inside @layer gets purged again').not.toContain('.tone-')
  })

  it('binds all five roles for every tone', () => {
    for (const tone of TONES) {
      for (const role of ['surface', 'foreground', 'mark', 'solid', 'on-solid']) {
        expect(css, `--tone-${tone}-${role} is not defined`).toContain(`--tone-${tone}-${role}:`)
      }
    }
  })

  it('paints each emphasis level', () => {
    for (const emphasis of ['soft', 'outline', 'solid', 'quiet'] satisfies Emphasis[]) {
      expect(css).toContain(`.tone-tag[data-emphasis='${emphasis}']`)
    }
  })
})

describe('the status maps', () => {
  it('only ever name a real tone', () => {
    for (const [name, map] of Object.entries(ALL_MAPS)) {
      for (const [value, tone] of Object.entries(map)) {
        expect(TONES, `${name}.${value} is not a tone`).toContain(tone)
      }
    }
  })

  it('falls back to neutral rather than to nothing', () => {
    expect(toneOf(PRIORITY_TONES, 'NOT_A_PRIORITY')).toBe('neutral')
    expect(toneOf(PRIORITY_TONES, null)).toBe('neutral')
    expect(toneOf(PRIORITY_TONES, undefined)).toBe('neutral')
  })

  it('falls back to soft emphasis for an untriaged value', () => {
    expect(emphasisOf(PRIORITY_EMPHASIS, 'NOT_A_PRIORITY')).toBe('soft')
    expect(emphasisOf(PRIORITY_EMPHASIS, null)).toBe('soft')
  })

  it('keeps priority quiet until it is worth shouting about', () => {
    // MEDIUM is the modal value; a chip on every row would say nothing.
    expect(emphasisOf(PRIORITY_EMPHASIS, 'LOW')).toBe('quiet')
    expect(emphasisOf(PRIORITY_EMPHASIS, 'MEDIUM')).toBe('quiet')
    expect(emphasisOf(PRIORITY_EMPHASIS, 'HIGH')).toBe('outline')
    expect(emphasisOf(PRIORITY_EMPHASIS, 'URGENT')).toBe('solid')
  })

  it('gives IN_PROGRESS one colour across requests, tasks and phases', () => {
    expect(TASK_STATUS_TONES.IN_PROGRESS).toBe('progress')
    expect(REQUEST_STATUS_TONES.IN_PROGRESS).toBe('progress')
    expect(PHASE_STATUS_TONES.IN_PROGRESS).toBe('progress')
    // The client's word for it is 'בפיתוח', but it is the same state and must
    // not be a different colour on the portal than it is in the dashboard.
    expect(CLIENT_REQUEST_STATUS_TONES.IN_PROGRESS).toBe('progress')
  })

  it('gives a waiting-on-someone-else state the same caution across maps', () => {
    // A quote the client has not answered and a phase awaiting their sign-off
    // are the same kind of thing: chase it, nothing is wrong.
    expect(PHASE_STATUS_TONES.PENDING_APPROVAL).toBe('caution')
    expect(CLIENT_REQUEST_STATUS_TONES.AWAITING_YOU).toBe('caution')
  })
})

describe('no call site re-invents a status colour', () => {
  const RAW_PALETTE =
    /\b(?:bg|text|border|ring|fill|stroke|from|to|via|accent)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/

  it('leaves no raw Tailwind palette classes in app/ or components/', () => {
    const files = [...walk('app'), ...walk('components')]
    expect(files.length).toBeGreaterThan(20)

    const offenders = files
      .map((f) => [f, readFileSync(join(ROOT, f), 'utf8')] as const)
      .flatMap(([f, body]) =>
        body
          .split('\n')
          .map((line, i) => ({ f, n: i + 1, hit: line.match(RAW_PALETTE)?.[0] }))
          .filter((x) => x.hit),
      )
      .map((x) => `${x.f}:${x.n} ${x.hit}`)

    expect(offenders, 'use a tone, not a raw palette shade').toEqual([])
  })
})
