# Dependencies Codemap

Freshness: 2026-03-26 | Deps: 34 prod, 15 dev

## External Services

| Service | Purpose | Config |
|---------|---------|--------|
| PostgreSQL (Supabase) | Primary database | DATABASE_URL, DIRECT_URL |
| NextAuth.js | Authentication | NEXTAUTH_SECRET, NEXTAUTH_URL |

## Core Framework

| Package | Version | Role |
|---------|---------|------|
| next | 15.5.9 | App Router framework |
| react / react-dom | 19.1.0 | UI runtime |
| typescript | ^5 | Type system |
| prisma / @prisma/client | ^6.16.1 | ORM + query client |

## Auth

| Package | Role |
|---------|------|
| next-auth ^4.24.11 | Session management, JWT, credentials provider |
| @auth/prisma-adapter ^2.10.0 | Prisma adapter for NextAuth |
| bcryptjs ^3.0.2 | Password hashing |

## UI

| Package | Role |
|---------|------|
| tailwindcss ^3.4.17 | Utility-first CSS |
| @radix-ui/* (11 packages) | Accessible primitives (shadcn/ui base) |
| class-variance-authority ^0.7.1 | Variant styling |
| clsx ^2.1.1 + tailwind-merge ^3.3.1 | Class merging (cn helper) |
| lucide-react ^0.544.0 | Icons |
| recharts ^3.2.1 | Dashboard charts |
| sonner ^2.0.7 | Toast notifications |
| next-themes ^0.4.6 | Theme switching |

## Data / Forms

| Package | Role |
|---------|------|
| zod ^4.1.8 | Schema validation |
| react-hook-form ^7.62.0 | Form state |
| @hookform/resolvers ^5.2.1 | Zod-RHF bridge |
| axios ^1.12.1 | HTTP client (lib/api/client.ts) |
| date-fns ^4.1.0 | Date formatting |

## State (installed, minimal use in redesign)

| Package | Role |
|---------|------|
| zustand ^5.0.8 | Client state (not actively used post-redesign) |

## Dev / Testing

| Package | Role |
|---------|------|
| @playwright/test ^1.58.2 | E2E testing (6 spec files) |
| eslint / eslint-config-next | Linting |
| @tailwindcss/postcss, postcss, autoprefixer | CSS build |
| ts-node ^10.9.2 | Seed script runner |

## E2E Test Coverage

| Spec File | Scope |
|-----------|-------|
| e2e/auth.spec.ts | Login flow |
| e2e/dashboard.spec.ts | Dashboard page |
| e2e/contacts.spec.ts | Contact CRUD |
| e2e/projects.spec.ts | Project CRUD |
| e2e/tasks.spec.ts | Task CRUD |
| e2e/navigation.spec.ts | Sidebar navigation |
