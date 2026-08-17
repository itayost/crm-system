import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth/auth.config'

const registerSchema = z.object({
  name: z.string().min(2, 'שם חייב להכיל לפחות 2 תווים'),
  email: z.string().email('אימייל לא תקין'),
  password: z.string().min(6, 'סיסמה חייבת להכיל לפחות 6 תווים'),
  role: z.enum(['USER', 'ADMIN']).optional().default('USER'),
})

/**
 * Create the very first user, and only the very first.
 *
 * `role` is forced to OWNER and the request body's own `role` is ignored: this
 * is the one path that runs unauthenticated, so it must not be able to mint
 * anything the caller chooses. Everything after the first user goes back
 * through the session-gated branch above.
 */
async function bootstrapFirstOwner(body: unknown) {
  const data = registerSchema.parse(body)

  try {
    const user = await prisma.$transaction(
      async (tx) => {
        if ((await tx.user.count()) > 0) return null

        const hashedPassword = await bcrypt.hash(data.password, 10)
        return tx.user.create({
          data: {
            name: data.name,
            email: data.email,
            password: hashedPassword,
            role: 'OWNER',
          },
          select: { id: true, email: true, name: true, role: true },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    )

    if (!user) {
      return NextResponse.json({ message: 'לא מורשה - נדרשת התחברות' }, { status: 401 })
    }

    return NextResponse.json({ message: 'משתמש נוצר בהצלחה', user })
  } catch (error) {
    // A serialization failure means another request won the race, which is the
    // same outcome as arriving second: the system already has an owner.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2034' || error.code === 'P2002')
    ) {
      return NextResponse.json({ message: 'לא מורשה - נדרשת התחברות' }, { status: 401 })
    }
    throw error
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    /**
     * First run: no owner exists yet, so nobody can be signed in to create one.
     *
     * Without this branch the whole flow is a dead end - the route demands a
     * session, and a session is impossible until a user exists, so the only way
     * to stand the system up was to reach past the API and insert a row by hand.
     *
     * The gate closes itself permanently the moment it is used once. It has to
     * be evaluated atomically, though: two concurrent posts would otherwise
     * both read zero and both mint an OWNER. Serializable makes Postgres abort
     * the loser rather than leaving the product with two owners.
     */
    if (!session?.user) {
      const bootstrapped = await bootstrapFirstOwner(await req.json())
      return bootstrapped
    }

    // Only OWNER and ADMIN can create new users
    if (session.user.role !== 'OWNER' && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { message: 'לא מורשה - נדרשות הרשאות מנהל' },
        { status: 403 }
      )
    }

    const body = await req.json()
    const validatedData = registerSchema.parse(body)

    // Only the OWNER may mint privileged accounts. Without this an ADMIN can
    // create further ADMINs and the role is effectively self-propagating.
    if (validatedData.role === 'ADMIN' && session.user.role !== 'OWNER') {
      return NextResponse.json(
        { message: 'לא מורשה - רק בעלים יכול ליצור מנהלים' },
        { status: 403 }
      )
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email }
    })
    
    if (existingUser) {
      return NextResponse.json(
        { message: 'משתמש עם אימייל זה כבר קיים' },
        { status: 400 }
      )
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validatedData.password, 10)
    
    // Create user
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        role: validatedData.role, // Use the role from request (defaults to USER)
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      }
    })
    
    return NextResponse.json({
      message: 'משתמש נוצר בהצלחה',
      user
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: error.issues[0].message },
        { status: 400 }
      )
    }

    console.error('Registration error:', error)
    return NextResponse.json(
      { message: 'שגיאה ביצירת משתמש' },
      { status: 500 }
    )
  }
}