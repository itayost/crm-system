// lib/api/api-handler.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { ZodError } from 'zod'

type Handler = (
  req: NextRequest,
  context: { params: Promise<{ [key: string]: string }>; userId: string }
) => Promise<NextResponse>

export function withAuth(handler: Handler) {
  return async (req: NextRequest, context: { params: Promise<{ [key: string]: string }> }) => {
    try {
      // Get the user session
      const session = await getServerSession(authOptions)

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }

      return await handler(req, { ...context, userId: session.user.id })
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation error', details: error.issues },
          { status: 400 }
        )
      }

      // Services raise their own Hebrew messages for things the user can act on
      // ("איש קשר לא נמצא"). Anything else - a Prisma fault, a null dereference -
      // would otherwise echo model and column names back to the caller as a 400.
      if (error instanceof Error && isUserFacingError(error)) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }

      console.error('API Error:', error)
      return NextResponse.json(
        { error: 'שגיאת שרת. נסה שוב.' },
        { status: 500 }
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

export function createResponse(data: unknown, status = 200) {
  return NextResponse.json(data, { status })
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status })
}