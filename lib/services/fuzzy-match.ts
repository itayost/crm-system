import { prisma } from '@/lib/db/prisma'

interface MatchResult<T> {
  match: T | null
  matches: T[]
  ambiguous: boolean
}

export async function fuzzyMatchContact(
  userId: string,
  nameQuery: string
): Promise<MatchResult<{ id: string; name: string; status: string; phone: string }>> {
  const contacts = await prisma.contact.findMany({
    where: { userId },
    select: { id: true, name: true, status: true, phone: true },
  })

  return fuzzyMatch(contacts, nameQuery, (c) => c.name)
}

export async function fuzzyMatchProject(
  userId: string,
  nameQuery: string
): Promise<MatchResult<{ id: string; name: string; status: string; contactId: string }>> {
  const projects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, name: true, status: true, contactId: true },
  })

  return fuzzyMatch(projects, nameQuery, (p) => p.name)
}

export async function fuzzyMatchTask(
  userId: string,
  titleQuery: string
): Promise<MatchResult<{ id: string; title: string; status: string; projectId: string | null }>> {
  const tasks = await prisma.task.findMany({
    where: { userId, status: { in: ['TODO', 'IN_PROGRESS'] } },
    select: { id: true, title: true, status: true, projectId: true },
  })

  return fuzzyMatch(tasks, titleQuery, (t) => t.title)
}

function fuzzyMatch<T>(
  items: T[],
  query: string,
  getName: (item: T) => string
): MatchResult<T> {
  const normalized = query.trim().toLowerCase()

  // 1. Exact match
  const exact = items.filter((item) => getName(item).toLowerCase() === normalized)
  if (exact.length === 1) return { match: exact[0], matches: exact, ambiguous: false }

  // 2. Starts-with match
  const startsWith = items.filter((item) =>
    getName(item).toLowerCase().startsWith(normalized)
  )
  if (startsWith.length === 1) return { match: startsWith[0], matches: startsWith, ambiguous: false }

  // 3. Contains match
  const contains = items.filter((item) =>
    getName(item).toLowerCase().includes(normalized)
  )
  if (contains.length === 1) return { match: contains[0], matches: contains, ambiguous: false }

  // Multiple or no matches
  const allMatches = contains.length > 0 ? contains : startsWith.length > 0 ? startsWith : []
  return {
    match: null,
    matches: allMatches,
    ambiguous: allMatches.length > 1,
  }
}
