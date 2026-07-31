import { prisma } from '@/lib/db/prisma'

/**
 * The client profile: what the support bot may know about a client, and may
 * therefore say. Bot-visible by design - the trust boundary with the private
 * `notes` field is the whole reason this is a separate column.
 *
 * The bot's only write access is the glossary: one bounded section it appends
 * to when a clarifying question resolves a client's term, so every
 * clarification becomes a permanent capability gain. The bounds are the
 * defence against a client steering the bot into writing something poisonous
 * into its own future prompts: short sanitized strings, in a data table, in a
 * capped section, fully visible on the client page.
 */

export const GLOSSARY_HEADER = '## מילון מונחים'

const MAX_TERM_CHARS = 30
const MAX_MEANING_CHARS = 80
const MAX_GLOSSARY_ENTRIES = 20

/** One line, bounded, no formatting a prompt could mistake for instructions. */
function sanitize(value: string, cap: number): string {
  return value.replace(/\s+/g, ' ').replace(/[#*_`>|]/g, '').trim().slice(0, cap)
}

export class ClientProfileService {
  static async getProfile(context: { clientId: string; userId: string }): Promise<string | null> {
    const client = await prisma.client.findFirst({
      where: { id: context.clientId, userId: context.userId },
      select: { profileHe: true },
    })
    return client?.profileHe?.trim() || null
  }

  /**
   * Adds (or replaces) one glossary mapping. Returns what actually happened -
   * the tool relays it to the model, which should not celebrate a write that
   * was refused.
   */
  static async addGlossaryEntry(
    context: { clientId: string; userId: string },
    rawTerm: string,
    rawMeaning: string
  ): Promise<'added' | 'replaced' | 'rejected' | 'full'> {
    const term = sanitize(rawTerm, MAX_TERM_CHARS)
    const meaning = sanitize(rawMeaning, MAX_MEANING_CHARS)
    if (!term || !meaning) return 'rejected'

    const client = await prisma.client.findFirst({
      where: { id: context.clientId, userId: context.userId },
      select: { id: true, profileHe: true },
    })
    if (!client) return 'rejected'

    const profile = client.profileHe ?? ''
    const { before, entries, after } = splitGlossary(profile)

    const existingIndex = entries.findIndex((entry) => entry.term === term)
    if (existingIndex === -1 && entries.length >= MAX_GLOSSARY_ENTRIES) return 'full'

    const nextEntries =
      existingIndex >= 0
        ? entries.map((entry, i) => (i === existingIndex ? { term, meaning } : entry))
        : [...entries, { term, meaning }]

    const section = [
      GLOSSARY_HEADER,
      ...nextEntries.map((entry) => `- ${entry.term} ← ${entry.meaning}`),
    ].join('\n')

    const nextProfile = [before.trim(), section, after.trim()]
      .filter(Boolean)
      .join('\n\n')

    await prisma.client.update({ where: { id: client.id }, data: { profileHe: nextProfile } })

    return existingIndex >= 0 ? 'replaced' : 'added'
  }
}

interface GlossaryEntry {
  term: string
  meaning: string
}

/** The profile around its glossary section; both sides survive edits intact. */
function splitGlossary(profile: string): {
  before: string
  entries: GlossaryEntry[]
  after: string
} {
  const headerAt = profile.indexOf(GLOSSARY_HEADER)
  if (headerAt === -1) return { before: profile, entries: [], after: '' }

  const sectionStart = headerAt + GLOSSARY_HEADER.length
  const nextHeaderOffset = profile.slice(sectionStart).search(/\n##\s/)
  const sectionEnd = nextHeaderOffset === -1 ? profile.length : sectionStart + nextHeaderOffset

  const entries = profile
    .slice(sectionStart, sectionEnd)
    .split('\n')
    .map((line) => line.match(/^-\s*(.+?)\s*←\s*(.+)$/))
    .filter((match): match is RegExpMatchArray => !!match)
    .map((match) => ({ term: match[1].trim(), meaning: match[2].trim() }))

  return {
    before: profile.slice(0, headerAt),
    entries,
    after: profile.slice(sectionEnd),
  }
}
