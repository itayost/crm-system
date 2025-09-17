# 🚀 מדריך פיתוח מלא - CRM System

## 📋 Table of Contents
1. [Initial Setup](#1-initial-setup)
2. [Database Setup](#2-database-setup)
3. [Authentication Implementation](#3-authentication-implementation)
4. [Layout & Navigation](#4-layout--navigation)
5. [Core Features Development](#5-core-features-development)
6. [API Development](#6-api-development)
7. [State Management](#7-state-management)
8. [WhatsApp Integration](#8-whatsapp-integration)
9. [Deployment](#9-deployment)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Initial Setup

### Step 1.1: Create Next.js Project
```bash
# Create new Next.js project with TypeScript and Tailwind
npx create-next-app@latest crm-system --typescript --tailwind --app
cd crm-system

# Open in VS Code
code .
```

### Step 1.2: Install Dependencies
```bash
# Core dependencies
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install prisma @prisma/client
npm install next-auth@beta @auth/prisma-adapter

# UI & Forms
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-label @radix-ui/react-select
npm install @radix-ui/react-slot @radix-ui/react-tabs
npm install react-hook-form zod @hookform/resolvers
npm install lucide-react date-fns
npm install recharts

# State & Data
npm install zustand @tanstack/react-query
npm install axios

# Utils
npm install clsx tailwind-merge class-variance-authority
npm install react-hot-toast

# Dev dependencies
npm install -D @types/node
```

### Step 1.3: Setup shadcn/ui
```bash
# Initialize shadcn/ui
npx shadcn-ui@latest init

# When prompted:
# - Would you like to use TypeScript? → Yes
# - Which style would you like to use? → Default
# - Which color would you like to use? → Slate
# - Where is your global CSS file? → app/globals.css
# - Would you like to use CSS variables? → Yes
# - Where is your tailwind.config.js? → tailwind.config.ts
# - Configure components.json? → Yes
# - Are you using React Server Components? → Yes

# Add components we'll need
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add form
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add select
npx shadcn-ui@latest add table
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add textarea
npx shadcn-ui@latest add toast
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add avatar
```

### Step 1.4: Project Structure Setup
```bash
# Create folder structure
mkdir -p app/api/auth
mkdir -p app/api/{leads,clients,projects,tasks,payments,time,reports,webhooks,cron}
mkdir -p app/(auth)/{login,register}
mkdir -p app/(dashboard)/{leads,clients,projects,tasks,payments,time,reports}
mkdir -p components/{ui,layout,forms,charts,shared}
mkdir -p lib/{db,auth,api,utils,hooks}
mkdir -p prisma
mkdir -p types
mkdir -p store
mkdir -p public/assets
```

### Step 1.5: Environment Variables
Create `.env.local`:
```env
# Database
DATABASE_URL="postgresql://[user]:[password]@[host]/[database]?sslmode=require"
DIRECT_URL="postgresql://[user]:[password]@[host]/[database]?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-random-secret-here"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-key"

# WhatsApp (for later)
WHATSAPP_API_KEY=""
WHATSAPP_PHONE_ID=""
WEBHOOK_SECRET="generate-random-secret"
```

### Step 1.6: Configure Tailwind for RTL
Update `tailwind.config.ts`:
```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: ['Heebo', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

### Step 1.7: Global Styles with RTL
Update `app/globals.css`:
```css
@import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }
 
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 48%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-family: 'Heebo', system-ui, sans-serif;
  }
  
  /* RTL Support */
  html[dir="rtl"] {
    direction: rtl;
  }
  
  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }
  
  ::-webkit-scrollbar-track {
    @apply bg-muted;
  }
  
  ::-webkit-scrollbar-thumb {
    @apply bg-muted-foreground/30 rounded-md;
  }
  
  ::-webkit-scrollbar-thumb:hover {
    @apply bg-muted-foreground/50;
  }
}

@layer utilities {
  /* RTL utilities */
  .rtl\:space-x-reverse > :not([hidden]) ~ :not([hidden]) {
    --tw-space-x-reverse: 1;
  }
}
```

---

## 2. Database Setup

### Step 2.1: Initialize Prisma
```bash
# Initialize Prisma with PostgreSQL
npx prisma init --datasource-provider postgresql
```

### Step 2.2: Create Schema
Update `prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// User model
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  password        String
  name            String
  role            UserRole @default(OWNER)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  leads           Lead[]
  clients         Client[]
  projects        Project[]
  tasks           Task[]
  payments        Payment[]
  notifications   Notification[]
  timeEntries     TimeEntry[]
}

// Lead model
model Lead {
  id              String      @id @default(cuid())
  name            String
  email           String?
  phone           String
  company         String?
  source          LeadSource
  status          LeadStatus  @default(NEW)
  projectType     String?
  estimatedBudget Decimal?    @db.Decimal(10, 2)
  notes           String?     @db.Text
  
  userId          String
  user            User        @relation(fields: [userId], references: [id])
  
  convertedToClientId String?
  convertedAt     DateTime?
  client          Client?     @relation(fields: [convertedToClientId], references: [id])
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  
  @@index([status])
  @@index([createdAt])
}

// Continue with all other models from the technical architecture document...
// (Add all models here)

// Enums
enum UserRole {
  OWNER
  ADMIN
  USER
}

enum LeadSource {
  WEBSITE
  PHONE
  WHATSAPP
  REFERRAL
  OTHER
}

enum LeadStatus {
  NEW
  CONTACTED
  QUOTED
  NEGOTIATING
  CONVERTED
  LOST
}

// Add all other enums...
```

### Step 2.3: Setup Supabase
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Get your database credentials
3. Update `.env.local` with the connection string

### Step 2.4: Run Migrations
```bash
# Generate Prisma client
npx prisma generate

# Create initial migration
npx prisma migrate dev --name init

# Seed the database (optional)
npx prisma db seed
```

### Step 2.5: Create Seed File
Create `prisma/seed.ts`:
```typescript
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Create test user
  const hashedPassword = await bcrypt.hash('password123', 10)
  
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
      role: 'OWNER',
    },
  })
  
  console.log('Seed data created:', { user })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

Update `package.json`:
```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

---

## 3. Authentication Implementation

### Step 3.1: Create Auth Configuration
Create `lib/auth/auth.config.ts`:
```typescript
import { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const authConfig: NextAuthConfig = {
  adapter: PrismaAdapter(prisma),
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        const validatedFields = loginSchema.safeParse(credentials)
        
        if (!validatedFields.success) {
          return null
        }
        
        const { email, password } = validatedFields.data
        
        const user = await prisma.user.findUnique({
          where: { email }
        })
        
        if (!user || !user.password) {
          return null
        }
        
        const passwordsMatch = await bcrypt.compare(password, user.password)
        
        if (!passwordsMatch) {
          return null
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}
```

### Step 3.2: Create Auth Route
Create `app/api/auth/[...nextauth]/route.ts`:
```typescript
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth/auth.config'

const handler = NextAuth(authConfig)

export { handler as GET, handler as POST }
```

### Step 3.3: Create Login Page
Create `app/(auth)/login/page.tsx`:
```typescript
'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'react-hot-toast'

export default function LoginPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      const result = await signIn('credentials', {
        email: formData.get('email'),
        password: formData.get('password'),
        redirect: false,
      })
      
      if (result?.error) {
        toast.error('Invalid credentials')
      } else {
        router.push('/dashboard')
        router.refresh()
      }
    } catch (error) {
      toast.error('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>התחברות למערכת</CardTitle>
          <CardDescription>הזן את פרטי ההתחברות שלך</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">אימייל</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="your@email.com"
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={isLoading}
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'מתחבר...' : 'התחבר'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

### Step 3.4: Create Middleware
Create `middleware.ts`:
```typescript
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  
  const isAuth = !!token
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') ||
                     request.nextUrl.pathname.startsWith('/register')
  
  if (isAuthPage) {
    if (isAuth) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return null
  }
  
  if (!isAuth) {
    let from = request.nextUrl.pathname
    if (request.nextUrl.search) {
      from += request.nextUrl.search
    }
    
    return NextResponse.redirect(
      new URL(`/login?from=${encodeURIComponent(from)}`, request.url)
    )
  }
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
```

---

## 4. Layout & Navigation

### Step 4.1: Create Dashboard Layout
Create `app/(dashboard)/layout.tsx`:
```typescript
import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

### Step 4.2: Create Sidebar Component
Create `components/layout/sidebar.tsx`:
```typescript
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Clock,
  DollarSign,
  BarChart,
  Target,
  Settings,
} from 'lucide-react'

const navigation = [
  { name: 'דשבורד', href: '/dashboard', icon: LayoutDashboard },
  { name: 'לידים', href: '/dashboard/leads', icon: Target },
  { name: 'לקוחות', href: '/dashboard/clients', icon: Users },
  { name: 'פרויקטים', href: '/dashboard/projects', icon: Briefcase },
  { name: 'זמנים', href: '/dashboard/time', icon: Clock },
  { name: 'תשלומים', href: '/dashboard/payments', icon: DollarSign },
  { name: 'דוחות', href: '/dashboard/reports', icon: BarChart },
  { name: 'הגדרות', href: '/dashboard/settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  
  return (
    <div className="w-64 bg-white shadow-lg h-screen sticky top-0">
      <div className="p-4">
        <h1 className="text-2xl font-bold text-gray-800">CRM System</h1>
      </div>
      
      <nav className="mt-8">
        {navigation.map((item) => {
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-6 py-3 text-gray-700 hover:bg-gray-100 transition-colors',
                pathname === item.href && 'bg-blue-50 text-blue-600 border-r-4 border-blue-600'
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
```

### Step 4.3: Create Header Component
Create `components/layout/header.tsx`:
```typescript
'use client'

import { Bell, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from 'next-auth/react'

export function Header() {
  return (
    <header className="bg-white shadow-sm border-b">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">ברוך הבא!</h2>
        </div>
        
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon">
            <Bell className="w-5 h-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <User className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>החשבון שלי</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>פרופיל</DropdownMenuItem>
              <DropdownMenuItem>הגדרות</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()}>
                התנתק
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
```

---

## 5. Core Features Development

### Step 5.1: Dashboard Page
Create `app/(dashboard)/dashboard/page.tsx`:
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { prisma } from '@/lib/db/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/auth.config'

async function getDashboardData(userId: string) {
  const [activeProjects, totalClients, pendingPayments, weeklyHours] = await Promise.all([
    prisma.project.count({
      where: { userId, status: 'IN_PROGRESS' }
    }),
    prisma.client.count({
      where: { userId }
    }),
    prisma.payment.count({
      where: { userId, status: 'PENDING' }
    }),
    // Add time calculation logic here
    Promise.resolve(28.5)
  ])
  
  return {
    activeProjects,
    totalClients,
    pendingPayments,
    weeklyHours
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authConfig)
  if (!session?.user?.id) return null
  
  const data = await getDashboardData(session.user.id)
  
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">דשבורד</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">פרויקטים פעילים</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.activeProjects}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">סה״כ לקוחות</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.totalClients}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">תשלומים ממתינים</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.pendingPayments}</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">שעות השבוע</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.weeklyHours}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
```

### Step 5.2: Leads API
Create `app/api/leads/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/auth.config'
import { z } from 'zod'

const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(1),
  company: z.string().optional(),
  source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']),
  projectType: z.string().optional(),
  estimatedBudget: z.number().optional(),
  notes: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authConfig)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const leads = await prisma.lead.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
  })
  
  return NextResponse.json(leads)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authConfig)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await req.json()
    const validatedData = createLeadSchema.parse(body)
    
    const lead = await prisma.lead.create({
      data: {
        ...validatedData,
        userId: session.user.id,
        status: 'NEW',
      },
    })
    
    return NextResponse.json(lead)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

### Step 5.3: Leads Page
Create `app/(dashboard)/leads/page.tsx`:
```typescript
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useState } from 'react'
import { LeadForm } from '@/components/forms/lead-form'
import api from '@/lib/api/client'
import { toast } from 'react-hot-toast'

const statusColors = {
  NEW: 'bg-red-100 text-red-800',
  CONTACTED: 'bg-orange-100 text-orange-800',
  QUOTED: 'bg-yellow-100 text-yellow-800',
  NEGOTIATING: 'bg-blue-100 text-blue-800',
  CONVERTED: 'bg-green-100 text-green-800',
  LOST: 'bg-gray-100 text-gray-800',
}

const statusLabels = {
  NEW: 'חדש',
  CONTACTED: 'יצרתי קשר',
  QUOTED: 'הצעת מחיר',
  NEGOTIATING: 'משא ומתן',
  CONVERTED: 'הומר ללקוח',
  LOST: 'אבוד',
}

export default function LeadsPage() {
  const [showForm, setShowForm] = useState(false)
  const queryClient = useQueryClient()
  
  const { data: leads, isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const response = await api.get('/leads')
      return response.data
    },
  })
  
  const createLead = useMutation({
    mutationFn: async (data: any) => {
      const response = await api.post('/leads', data)
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      setShowForm(false)
      toast.success('ליד נוסף בהצלחה!')
    },
    onError: () => {
      toast.error('שגיאה ביצירת ליד')
    },
  })
  
  if (isLoading) {
    return <div>טוען...</div>
  }
  
  // Group leads by status
  const leadsByStatus = leads?.reduce((acc: any, lead: any) => {
    if (!acc[lead.status]) acc[lead.status] = []
    acc[lead.status].push(lead)
    return acc
  }, {})
  
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">ניהול לידים</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          + ליד חדש
        </Button>
      </div>
      
      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>הוספת ליד חדש</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadForm onSubmit={createLead.mutate} />
          </CardContent>
        </Card>
      )}
      
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(statusLabels).map(([status, label]) => (
          <div key={status} className="bg-white rounded-lg shadow p-4">
            <h3 className="font-bold mb-3">{label}</h3>
            <div className="space-y-3">
              {leadsByStatus?.[status]?.map((lead: any) => (
                <Card key={lead.id} className="cursor-pointer hover:shadow-md transition">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium">{lead.name}</h4>
                      <Badge className={statusColors[lead.status as keyof typeof statusColors]}>
                        {statusLabels[lead.status as keyof typeof statusLabels]}
                      </Badge>
                    </div>
                    {lead.company && (
                      <p className="text-sm text-gray-600">{lead.company}</p>
                    )}
                    <p className="text-sm text-gray-600">{lead.phone}</p>
                    {lead.projectType && (
                      <p className="text-sm text-blue-600 mt-2">{lead.projectType}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Step 5.4: Lead Form Component
Create `components/forms/lead-form.tsx`:
```typescript
'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

const leadSchema = z.object({
  name: z.string().min(1, 'שם חובה'),
  email: z.string().email('אימייל לא תקין').optional().or(z.literal('')),
  phone: z.string().min(10, 'טלפון חובה'),
  company: z.string().optional(),
  source: z.enum(['WEBSITE', 'PHONE', 'WHATSAPP', 'REFERRAL', 'OTHER']),
  projectType: z.string().optional(),
  estimatedBudget: z.string().optional(),
  notes: z.string().optional(),
})

type LeadFormData = z.infer<typeof leadSchema>

interface LeadFormProps {
  onSubmit: (data: LeadFormData) => void
}

export function LeadForm({ onSubmit }: LeadFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
  })
  
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="name">שם מלא *</Label>
          <Input id="name" {...register('name')} />
          {errors.name && (
            <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="phone">טלפון *</Label>
          <Input id="phone" {...register('phone')} />
          {errors.phone && (
            <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="email">אימייל</Label>
          <Input id="email" type="email" {...register('email')} />
          {errors.email && (
            <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
          )}
        </div>
        
        <div>
          <Label htmlFor="company">חברה</Label>
          <Input id="company" {...register('company')} />
        </div>
        
        <div>
          <Label htmlFor="source">מקור הליד *</Label>
          <Select onValueChange={(value) => setValue('source', value as any)}>
            <SelectTrigger>
              <SelectValue placeholder="בחר מקור" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="WEBSITE">אתר</SelectItem>
              <SelectItem value="PHONE">טלפון</SelectItem>
              <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
              <SelectItem value="REFERRAL">המלצה</SelectItem>
              <SelectItem value="OTHER">אחר</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="projectType">סוג פרויקט</Label>
          <Select onValueChange={(value) => setValue('projectType', value)}>
            <SelectTrigger>
              <SelectValue placeholder="בחר סוג פרויקט" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="אתר תדמית">אתר תדמית</SelectItem>
              <SelectItem value="חנות אונליין">חנות אונליין</SelectItem>
              <SelectItem value="אפליקציה">אפליקציה</SelectItem>
              <SelectItem value="מערכת ניהול">מערכת ניהול</SelectItem>
              <SelectItem value="דף נחיתה">דף נחיתה</SelectItem>
              <SelectItem value="ייעוץ">ייעוץ</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <Label htmlFor="estimatedBudget">תקציב משוער</Label>
          <Input
            id="estimatedBudget"
            type="number"
            {...register('estimatedBudget')}
            placeholder="₪"
          />
        </div>
      </div>
      
      <div>
        <Label htmlFor="notes">הערות</Label>
        <Textarea id="notes" {...register('notes')} rows={3} />
      </div>
      
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline">
          ביטול
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'שומר...' : 'שמור ליד'}
        </Button>
      </div>
    </form>
  )
}
```

### Step 5.5: Projects API
Create `app/api/projects/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/auth.config'
import { z } from 'zod'

const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['LANDING_PAGE', 'WEBSITE', 'ECOMMERCE', 'WEB_APP', 'MOBILE_APP', 'MANAGEMENT_SYSTEM', 'CONSULTATION']),
  clientId: z.string(),
  budget: z.number().optional(),
  estimatedHours: z.number().optional(),
  deadline: z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await getServerSession(authConfig)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: {
      client: true,
      tasks: true,
      _count: {
        select: {
          tasks: true,
          timeEntries: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
  
  return NextResponse.json(projects)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authConfig)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  try {
    const body = await req.json()
    const validatedData = createProjectSchema.parse(body)
    
    const project = await prisma.project.create({
      data: {
        ...validatedData,
        userId: session.user.id,
        status: 'DRAFT',
        stage: 'PLANNING',
        deadline: validatedData.deadline ? new Date(validatedData.deadline) : undefined,
      },
      include: {
        client: true,
      },
    })
    
    return NextResponse.json(project)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

### Step 5.6: Time Tracking Components
Create `components/timer/timer-widget.tsx`:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Play, Pause, Square } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { toast } from 'react-hot-toast'
import api from '@/lib/api/client'

export function TimerWidget() {
  const { activeTimer, startTimer, stopTimer } = useAppStore()
  const [elapsed, setElapsed] = useState(0)
  
  useEffect(() => {
    let interval: NodeJS.Timeout
    
    if (activeTimer) {
      interval = setInterval(() => {
        const start = new Date(activeTimer.startTime).getTime()
        const now = Date.now()
        setElapsed(Math.floor((now - start) / 1000))
      }, 1000)
    }
    
    return () => clearInterval(interval)
  }, [activeTimer])
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  
  const handleStart = async (projectId: string) => {
    try {
      const response = await api.post('/time/start', { projectId })
      startTimer(projectId)
      toast.success('טיימר הופעל')
    } catch (error) {
      toast.error('שגיאה בהפעלת טיימר')
    }
  }
  
  const handleStop = async () => {
    if (!activeTimer) return
    
    try {
      await api.post('/time/stop', {
        projectId: activeTimer.projectId,
        startTime: activeTimer.startTime,
      })
      stopTimer()
      toast.success('טיימר נעצר')
    } catch (error) {
      toast.error('שגיאה בעצירת טיימר')
    }
  }
  
  if (!activeTimer) {
    return (
      <Card className="fixed bottom-6 left-6 shadow-lg">
        <CardContent className="p-4">
          <p className="text-sm text-gray-600 mb-2">טיימר לא פעיל</p>
          <Button size="sm" onClick={() => handleStart('demo-project-id')}>
            <Play className="w-4 h-4 mr-2" />
            התחל טיימר
          </Button>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <Card className="fixed bottom-6 left-6 shadow-lg bg-blue-600 text-white">
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-2xl font-bold font-mono">{formatTime(elapsed)}</p>
            <p className="text-xs opacity-90">פרויקט פעיל</p>
          </div>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="secondary"
              onClick={handleStop}
              className="bg-white text-blue-600 hover:bg-gray-100"
            >
              <Square className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

---

## 6. API Development

### Step 6.1: Create API Utils
Create `lib/api/api-handler.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authConfig } from '@/lib/auth/auth.config'
import { ZodError } from 'zod'

type Handler = (
  req: NextRequest,
  context: { params: any; userId: string }
) => Promise<NextResponse>

export function withAuth(handler: Handler) {
  return async (req: NextRequest, context: { params: any }) => {
    const session = await getServerSession(authConfig)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    try {
      return await handler(req, { ...context, userId: session.user.id })
    } catch (error) {
      if (error instanceof ZodError) {
        return NextResponse.json(
          { error: error.errors },
          { status: 400 }
        )
      }
      
      console.error('API Error:', error)
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
  }
}
```

### Step 6.2: Create API Client
Create `lib/api/client.ts`:
```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if needed
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

---

## 7. State Management

### Step 7.1: Create Zustand Store
Create `store/app-store.ts`:
```typescript
import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

interface AppState {
  // UI State
  sidebarOpen: boolean
  toggleSidebar: () => void
  
  // Timer State
  activeTimer: {
    projectId: string
    taskId?: string
    startTime: Date
  } | null
  startTimer: (projectId: string, taskId?: string) => void
  stopTimer: () => void
  
  // Notifications
  notifications: Array<{
    id: string
    type: 'info' | 'success' | 'warning' | 'error'
    message: string
    read: boolean
  }>
  addNotification: (notification: Omit<AppState['notifications'][0], 'id'>) => void
  markAsRead: (id: string) => void
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set) => ({
        // UI State
        sidebarOpen: true,
        toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
        
        // Timer State
        activeTimer: null,
        startTimer: (projectId, taskId) =>
          set({ activeTimer: { projectId, taskId, startTime: new Date() } }),
        stopTimer: () => set({ activeTimer: null }),
        
        // Notifications
        notifications: [],
        addNotification: (notification) =>
          set((state) => ({
            notifications: [
              { ...notification, id: Date.now().toString() },
              ...state.notifications,
            ],
          })),
        markAsRead: (id) =>
          set((state) => ({
            notifications: state.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n
            ),
          })),
      }),
      {
        name: 'crm-storage',
      }
    )
  )
)
```

### Step 7.2: Create React Query Provider
Create `providers/query-provider.tsx`:
```typescript
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  )
  
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
```

---

## 8. WhatsApp Integration

### Step 8.1: WhatsApp Service
Create `lib/services/whatsapp.ts`:
```typescript
import axios from 'axios'

const WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0'
const PHONE_ID = process.env.WHATSAPP_PHONE_ID
const TOKEN = process.env.WHATSAPP_API_KEY

interface SendMessageParams {
  to: string
  message: string
  template?: string
}

export async function sendWhatsAppMessage({ to, message }: SendMessageParams) {
  if (!PHONE_ID || !TOKEN) {
    console.error('WhatsApp credentials not configured')
    return
  }
  
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to.replace('+', ''),
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    )
    
    return response.data
  } catch (error) {
    console.error('WhatsApp send error:', error)
    throw error
  }
}

// Send notification for new lead
export async function notifyNewLead(leadName: string, phone: string) {
  const message = `🎯 ליד חדש!\n\nשם: ${leadName}\nטלפון: ${phone}\n\nכדאי לחזור אליו בהקדם!`
  
  // Send to your WhatsApp number
  await sendWhatsAppMessage({
    to: process.env.OWNER_WHATSAPP_NUMBER!,
    message,
  })
}
```

### Step 8.2: Webhook for Lead
Create `app/api/webhooks/lead/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { notifyNewLead } from '@/lib/services/whatsapp'
import crypto from 'crypto'

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex')
  
  return signature === expectedSignature
}

export async function POST(req: NextRequest) {
  const signature = req.headers.get('x-webhook-signature')
  const payload = await req.text()
  
  // Verify webhook signature
  if (!signature || !verifyWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }
  
  const data = JSON.parse(payload)
  
  try {
    // Create lead in database
    const lead = await prisma.lead.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        source: 'WEBSITE',
        status: 'NEW',
        notes: data.message,
        userId: process.env.DEFAULT_USER_ID!, // You'll need to set this
      },
    })
    
    // Send WhatsApp notification
    await notifyNewLead(lead.name, lead.phone)
    
    return NextResponse.json({ success: true, leadId: lead.id })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

---

## 9. Deployment

### Step 9.1: Prepare for Production
```bash
# Build the project
npm run build

# Test the production build
npm run start
```

### Step 9.2: Deploy to Vercel
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow the prompts:
# - Link to existing project or create new
# - Configure environment variables
# - Deploy
```

### Step 9.3: Configure Environment Variables in Vercel
Go to your Vercel dashboard and add all environment variables from `.env.local`

### Step 9.4: Setup Cron Jobs
Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/reminders",
      "schedule": "0 10 * * *"
    }
  ]
}
```

---

## 10. Troubleshooting

### Common Issues and Solutions

#### Issue: Prisma Client not generated
```bash
npx prisma generate
```

#### Issue: Database connection failed
- Check DATABASE_URL in .env.local
- Ensure Supabase project is active
- Check connection pooling settings

#### Issue: Authentication not working
- Verify NEXTAUTH_SECRET is set
- Check callback URLs
- Clear cookies and try again

#### Issue: RTL layout issues
- Ensure `dir="rtl"` is set on root element
- Use logical properties (start/end instead of left/right)
- Test with Hebrew content

#### Issue: WhatsApp not sending
- Verify WhatsApp Business API credentials
- Check phone number format (remove +)
- Review Meta/Facebook developer console for errors

### Debugging Tips

1. **Enable Debug Mode**
```typescript
// Add to .env.local
DEBUG=*
```

2. **Check Prisma Queries**
```typescript
// Add logging to Prisma
const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
})
```

3. **Monitor API Calls**
Use browser DevTools Network tab to inspect API requests/responses

4. **Check Vercel Logs**
```bash
vercel logs
```

---

## 📚 Additional Resources

### Useful Commands
```bash
# Database Commands
npx prisma studio          # Open Prisma Studio GUI
npx prisma migrate reset   # Reset database and replay migrations
npx prisma db push        # Push schema changes without migration
npx prisma db seed        # Run seed script
npx prisma generate       # Generate Prisma Client
npx prisma migrate dev    # Create and apply migration
npx prisma migrate deploy # Apply migrations in production
npx prisma format         # Format schema file
npx prisma validate       # Validate schema

# Development Commands
npm run dev              # Start dev server (port 3000)
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run ESLint
npm run lint:fix        # Fix ESLint issues
npm run type-check      # Check TypeScript types
npm run format          # Run Prettier

# Testing Commands
npm test                # Run tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
npm run test:e2e        # End-to-end tests

# Vercel Commands
vercel                  # Deploy to preview
vercel --prod          # Deploy to production
vercel env pull        # Pull environment variables
vercel logs            # View function logs
vercel logs --follow   # Real-time logs

# Git Commands
git add .              # Stage all changes
git commit -m "feat: " # Commit with conventional format
git push origin main   # Push to main branch
git pull --rebase     # Pull with rebase
git stash             # Stash changes
git stash pop         # Apply stashed changes
```

### Helpful Links

#### Documentation
- [Next.js 14 Docs](https://nextjs.org/docs) - Framework documentation
- [Prisma Docs](https://www.prisma.io/docs) - ORM documentation
- [NextAuth.js](https://next-auth.js.org) - Authentication docs
- [Tailwind CSS](https://tailwindcss.com/docs) - Styling documentation
- [shadcn/ui](https://ui.shadcn.com) - Component library
- [Supabase Docs](https://supabase.com/docs) - Database platform
- [React Hook Form](https://react-hook-form.com) - Form handling
- [Zod Documentation](https://zod.dev) - Schema validation
- [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction) - State management
- [React Query](https://tanstack.com/query/latest) - Data fetching

#### Tools & Services
- [Vercel Dashboard](https://vercel.com/dashboard) - Deployment platform
- [Supabase Dashboard](https://app.supabase.com) - Database management
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp) - Messaging API
- [Meta Business](https://business.facebook.com) - WhatsApp configuration
- [Excalidraw](https://excalidraw.com) - Diagram tool
- [Figma](https://www.figma.com) - Design tool
- [Postman](https://www.postman.com) - API testing

#### Learning Resources
- [Next.js Learn](https://nextjs.org/learn) - Official tutorial
- [Prisma Playground](https://playground.prisma.io) - Practice Prisma
- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook) - TS guide
- [React Patterns](https://reactpatterns.com) - Best practices
- [Web.dev](https://web.dev) - Performance guides

### Project Structure Best Practices

```
crm-system/
├── app/                      # Next.js 14 App Router
│   ├── (auth)/              # Auth group - public routes
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/         # Dashboard group - protected routes
│   │   ├── layout.tsx       # Dashboard layout with sidebar
│   │   ├── page.tsx         # Dashboard home
│   │   └── [module]/        # Feature modules
│   ├── api/                 # API routes
│   │   └── [resource]/      # RESTful endpoints
│   └── layout.tsx           # Root layout
│
├── components/              # React components
│   ├── ui/                 # Base UI components (shadcn)
│   ├── forms/              # Form components
│   ├── layout/             # Layout components
│   └── shared/             # Shared/common components
│
├── lib/                    # Utilities and configurations
│   ├── auth/              # Auth configuration
│   ├── db/                # Database client
│   ├── api/               # API utilities
│   ├── services/          # External services
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Helper functions
│
├── prisma/                # Database
│   ├── schema.prisma      # Database schema
│   ├── seed.ts           # Seed script
│   └── migrations/       # Migration files
│
├── public/               # Static files
│   └── assets/          # Images, fonts, etc.
│
├── store/               # State management
│   └── app-store.ts    # Zustand store
│
├── styles/             # Global styles
│   └── globals.css    # Tailwind imports
│
├── types/              # TypeScript types
│   └── index.d.ts     # Global type definitions
│
└── config files        # Configuration
    ├── .env.local      # Environment variables
    ├── .eslintrc.json  # ESLint config
    ├── .prettierrc     # Prettier config
    ├── tailwind.config.ts
    ├── tsconfig.json
    ├── next.config.js
    └── package.json
```

### Code Standards Checklist

#### ✅ DO:
- **Keep components small and focused** - Single responsibility
- **Use TypeScript strictly** - No `any` types
- **Implement error boundaries** - Catch component errors
- **Add loading states** - For all async operations
- **Use environment variables** - For secrets and config
- **Write meaningful commit messages** - Use conventional commits
- **Test critical paths** - Auth, payments, data operations
- **Comment complex logic** - In Hebrew for UI, English for code
- **Optimize images** - Use next/image component
- **Handle edge cases** - Empty states, errors, loading
- **Follow REST conventions** - For API routes
- **Use semantic HTML** - For accessibility
- **Implement proper SEO** - Meta tags, descriptions
- **Cache appropriately** - Use React Query caching
- **Validate all inputs** - Client and server side

#### ❌ DON'T:
- **Hardcode sensitive data** - Use environment variables
- **Skip error handling** - Always use try-catch
- **Ignore TypeScript errors** - Fix them properly
- **Use `any` type** - Define proper types
- **Forget RTL support** - Test with Hebrew content
- **Skip loading states** - Users need feedback
- **Mutate state directly** - Use immutable updates
- **Ignore performance** - Profile and optimize
- **Use inline styles** - Use Tailwind classes
- **Forget mobile view** - Test responsive design
- **Skip validation** - Validate on both ends
- **Ignore accessibility** - Use ARIA labels
- **Commit broken code** - Test before pushing
- **Use console.log in production** - Remove or use proper logging
- **Forget to handle null/undefined** - Use optional chaining

### Git Workflow

```bash
# Feature branch workflow
git checkout -b feature/add-payment-module
git add .
git commit -m "feat: add payment tracking module"
git push origin feature/add-payment-module
# Create PR on GitHub

# Commit message format
feat: add new feature
fix: fix bug
docs: update documentation
style: formatting changes
refactor: code restructuring
test: add tests
chore: maintenance tasks

# Example commits
git commit -m "feat: add WhatsApp notifications for new leads"
git commit -m "fix: resolve RTL layout issue in sidebar"
git commit -m "docs: update API documentation"
git commit -m "refactor: optimize dashboard queries"
```

### Environment Variables Template

```env
# Database (Supabase)
DATABASE_URL="postgresql://[user]:[password]@[host]:5432/[database]?sslmode=require"
DIRECT_URL="postgresql://[user]:[password]@[host]:5432/[database]?sslmode=require"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="[generate-with-openssl-rand-base64-32]"

# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://[project].supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="[anon-key]"
SUPABASE_SERVICE_ROLE_KEY="[service-role-key]"

# WhatsApp Business API
WHATSAPP_API_KEY="[meta-api-key]"
WHATSAPP_PHONE_ID="[phone-number-id]"
WHATSAPP_BUSINESS_ID="[business-account-id]"
WHATSAPP_VERIFY_TOKEN="[webhook-verify-token]"
OWNER_WHATSAPP_NUMBER="972501234567"

# Webhook Security
WEBHOOK_SECRET="[generate-random-string]"

# Email (Resend)
RESEND_API_KEY="[resend-api-key]"
EMAIL_FROM="noreply@yourdomain.com"

# Monitoring (Optional)
SENTRY_DSN="[sentry-dsn]"
NEXT_PUBLIC_SENTRY_DSN="[sentry-dsn]"

# Analytics (Optional)
NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"

# Development
DEFAULT_USER_ID="[your-user-id-for-webhooks]"
```

---

## 🎉 Congratulations!

You now have a complete development guide for your CRM system. Follow this guide step by step, and you'll have a working system in 9 weeks!

### Final Tips:
1. **Start small** - Get the basics working first
2. **Test often** - Don't wait until the end
3. **Commit regularly** - Save your progress
4. **Ask for help** - Don't get stuck for too long
5. **Document as you go** - Future you will thank you
6. **Take breaks** - Fresh eyes catch more bugs
7. **Celebrate milestones** - Each completed feature is progress

### Remember:
- 📚 **Read the docs** when stuck
- 🧪 **Test your code** before deploying
- 🔐 **Keep secrets secret** - never commit .env files
- 🎨 **Polish later** - functionality first, beauty second
- 🚀 **Ship it** - perfect is the enemy of good

Good luck with your development! You've got this! 💪