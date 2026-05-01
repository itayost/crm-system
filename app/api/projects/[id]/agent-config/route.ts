import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { withAuth, createResponse } from '@/lib/api/api-handler'
import { prisma } from '@/lib/db/prisma'

const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*$/, 'lowercase, digits, hyphens; cannot start with hyphen')

const createSchema = z.object({
  agentSlug: slugSchema,
  status: z.enum(['ACTIVE', 'PAUSED', 'DISABLED']).default('ACTIVE'),
  githubOwner: z.string().min(1),
  githubRepo: z.string().min(1),
  githubBranch: z.string().min(1).default('main'),
  vercelTeamId: z.string().min(1),
  vercelProjectId: z.string().min(1),
  supabaseProjectRef: z.string().min(1).nullable().optional(),
  smokeUrl: z.string().url().nullable().optional(),
  domains: z.array(z.string().min(1)).default([]),
  safetyConfig: z.record(z.string(), z.unknown()),
  morningReportInclude: z.boolean().default(true),
  ingestionConfig: z.record(z.string(), z.unknown()).nullable().optional(),
})

// PATCH disallows agentSlug edits — slug is immutable once set.
const updateSchema = createSchema.omit({ agentSlug: true }).partial()

export const POST = withAuth(async (req: NextRequest, { params }) => {
  const { id: projectId } = await params
  const body = createSchema.parse(await req.json())
  const created = await prisma.agentProjectConfig.create({
    data: {
      ...body,
      projectId,
      safetyConfig: body.safetyConfig as Prisma.InputJsonValue,
      ingestionConfig: body.ingestionConfig as Prisma.InputJsonValue ?? Prisma.JsonNull,
    },
  })
  return createResponse(created, 201)
})

export const PATCH = withAuth(async (req: NextRequest, { params }) => {
  const { id: projectId } = await params
  const { safetyConfig, ingestionConfig, ...rest } = updateSchema.parse(await req.json())
  const updated = await prisma.agentProjectConfig.update({
    where: { projectId },
    data: {
      ...rest,
      ...(safetyConfig !== undefined && {
        safetyConfig: safetyConfig as Prisma.InputJsonValue,
      }),
      ...(ingestionConfig !== undefined && {
        ingestionConfig: (ingestionConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      }),
    },
  })
  return createResponse(updated)
})
