// lib/api/api-handler.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { ZodError } from 'zod'

type Handler = (
  req: NextRequest,
  context: { params: Promise<{ [key: string]: string }>; userId: string }
) => Promise<NextResponse>

const NO_STORE = { 'Cache-Control': 'no-store, must-revalidate' }

export function withAuth(handler: Handler) {
  return async (req: NextRequest, context: { params: Promise<{ [key: string]: string }> }) => {
    try {
      // Get the user session
      const session = await getServerSession(authOptions)

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401, headers: NO_STORE }
        )
      }

      return await handler(req, { ...context, userId: session.user.id })
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation error', details: error.issues },
          { status: 400, headers: NO_STORE }
        )
      }

      // Services raise their own Hebrew messages for things the user can act on
      // ("איש קשר לא נמצא"). Anything else - a Prisma fault, a null dereference -
      // would otherwise echo model and column names back to the caller as a 400.
      if (error instanceof Error && isUserFacingError(error)) {
        return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE })
      }

      console.error('API Error:', error)
      return NextResponse.json(
        { error: 'שגיאת שרת. נסה שוב.' },
        { status: 500, headers: NO_STORE }
      )
    }
  }
}

/**
 * Errors the services raise on purpose are written in Hebrew and are safe to
 * show. Everything else is an internal fault and must not reach the client.
 */
function isUserFacingError(error: Error): boolean {
  if (error.name !== 'Error') return false
  return /[֐-׿]/.test(error.message)
}

/**
 * `must-revalidate` still lets the browser serve a cached body while it
 * revalidates, which showed up as a detail page reverting to its pre-mutation
 * state right after a successful save. CRM data is per-user and always live, so
 * none of it should be cached anywhere.
 */
export function createResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE })
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE })
}