import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'
import { errorResponse } from './api-handler'

type AuthenticatedHandler = (
  req: NextRequest,
  userId: string
) => Promise<NextResponse>

/**
 * Wraps an API handler with authentication check
 */
export function withAuth(handler: AuthenticatedHandler) {
  return async (req: NextRequest) => {
    try {
      // Get the session from NextAuth
      const session = await getServerSession(authOptions)

      if (!session || !session.user) {
        return errorResponse('Unauthorized', 401)
      }

      // Call the handler with the user ID
      return await handler(req, session.user.id)
    } catch (error) {
      console.error('Auth handler error:', error)
      return errorResponse('Authentication failed', 500)
    }
  }
}

/**
 * Get current user ID from session
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.id || null
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getServerSession(authOptions)
  return !!session?.user
}