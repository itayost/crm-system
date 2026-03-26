# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# Development server
npm run dev          # Start Next.js development server on http://localhost:3000

# Build & Production
npm run build        # Build the production-ready application
npm start            # Start production server

# Code Quality
npm run lint         # Run ESLint for code quality checks

# Database (Prisma)
npm run db:push      # Push schema changes to database without migrations
npm run db:migrate   # Apply migrations to the database
npm run db:seed      # Seed the database with initial data
npm run db:studio    # Open Prisma Studio for database management

# Testing
npm run test:e2e     # Run Playwright E2E tests (43 tests across 6 spec files)
```

## Project Overview

A **Next.js 15 CRM system** for a Hebrew-speaking freelancer (RTL). The system was redesigned from a 12-model architecture down to **4 core models** (User, Contact, Project, Task) for simplicity and maintainability.

## Business Context

The CRM is built for a freelancer in the digital field who:

- Manages ~10 clients with many one-time projects
- Handles multiple active projects (landing pages, apps, websites, consultations)
- Works with capacity for 3-4 large or 6-7 small projects simultaneously
- Needs efficient time management and accurate project tracking
- Requires fast lead response (< 2 hours)

## Technology Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **UI**: Tailwind CSS, Radix UI primitives, shadcn/ui components
- **Authentication**: NextAuth.js v4 with JWT strategy and credentials provider
- **Database**: PostgreSQL (Supabase) with Prisma ORM
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for dashboard analytics
- **Notifications**: react-hot-toast (dashboard), Sonner (toasts)
- **Styling**: Tailwind CSS with RTL support, Hebrew font (Heebo)
- **Testing**: Playwright for E2E tests
- **HTTP Client**: Axios via `lib/api/client.ts`

## Data Model (4 Models)

The schema (`prisma/schema.prisma`) has 4 models:

### User

- Authentication and ownership; all data is scoped to a user
- Roles: OWNER, ADMIN, USER

### Contact

- **Unified model replacing the old Lead + Client split**
- Status progression: NEW -> CONTACTED -> QUOTED -> NEGOTIATING -> CLIENT -> INACTIVE
- Statuses NEW through NEGOTIATING represent leads; CLIENT and INACTIVE represent clients
- The `ContactsService` uses a `phase` filter (`lead` | `client`) to distinguish them
- `convertedAt` timestamp marks when a lead became a client
- Sources: WEBSITE, PHONE, WHATSAPP, REFERRAL, OTHER
- Fields: name, email, phone, company, estimatedBudget, projectType, isVip, address, taxId, notes

### Project

- Belongs to a Contact (must have CLIENT status to create a project)
- Statuses: DRAFT -> IN_PROGRESS -> ON_HOLD -> COMPLETED -> CANCELLED
- Types: LANDING_PAGE, WEBSITE, ECOMMERCE, WEB_APP, MOBILE_APP, MANAGEMENT_SYSTEM, CONSULTATION
- Priority: LOW, MEDIUM, HIGH, URGENT
- **Pricing on the project itself** -- `price` (one-time) and `retention` + `retentionFrequency` (recurring) replace the old separate Payments module
- Has many Tasks

### Task

- Optionally linked to a Project (standalone tasks are also supported)
- Statuses: TODO, IN_PROGRESS, COMPLETED, CANCELLED
- Priority: LOW, MEDIUM, HIGH, URGENT

## Architecture

### Directory Structure

```text
app/
  (auth)/
    login/page.tsx           # Login page
    layout.tsx               # Auth layout
  (dashboard)/
    page.tsx                 # Dashboard (KPIs, recent items, charts)
    layout.tsx               # Dashboard layout with sidebar + header
    contacts/
      page.tsx               # Contacts list with lead/client phase tabs
      [id]/page.tsx          # Contact detail page
    projects/
      page.tsx               # Projects list with status filters
      [id]/page.tsx          # Project detail with tasks
    tasks/
      page.tsx               # Tasks list with filters
  api/
    auth/
      [...nextauth]/route.ts # NextAuth handler
      register/route.ts      # User registration
    contacts/
      route.ts               # GET (list) + POST (create)
      [id]/route.ts          # GET + PUT + DELETE
    projects/
      route.ts               # GET (list) + POST (create)
      [id]/route.ts          # GET + PUT + DELETE
    tasks/
      route.ts               # GET (list) + POST (create)
      [id]/route.ts          # GET + PUT + DELETE
    dashboard/
      route.ts               # GET dashboard aggregate data

lib/
  api/
    api-handler.ts           # Shared API route handler wrapper
    auth-handler.ts          # Authentication helper for API routes
    client.ts                # Axios client for frontend API calls
  auth/
    auth.config.ts           # NextAuth provider configuration
    auth.ts                  # NextAuth instance
  db/
    prisma.ts                # Prisma client singleton
  services/
    contacts.service.ts      # Contact CRUD, phase filtering, lead-to-client conversion
    projects.service.ts      # Project CRUD with contact validation
    tasks.service.ts         # Task CRUD with project linking
    dashboard.service.ts     # Dashboard aggregation queries
  validations/
    contact.ts               # Zod schemas for contact input
    project.ts               # Zod schemas for project input
    task.ts                  # Zod schemas for task input
  config/                    # Configuration (currently empty)
  errors/                    # Error utilities (currently empty)
  hooks/                     # Custom hooks (currently empty)
  utils/                     # Utility functions (currently empty)
  utils.ts                   # cn() helper for classnames

components/
  forms/
    contact-form.tsx         # Contact create/edit form
    project-form.tsx         # Project create/edit form
    task-form.tsx            # Task create/edit form
  layout/
    header.tsx               # Top header with user info
    sidebar.tsx              # Navigation sidebar
  ui/                        # shadcn/ui components (23 components)
  charts/                    # Chart components (currently empty)
  shared/                    # Shared components (currently empty)

e2e/
  auth.spec.ts               # Authentication flows
  dashboard.spec.ts          # Dashboard page tests
  contacts.spec.ts           # Contact CRUD and conversion tests
  projects.spec.ts           # Project CRUD and status transition tests
  tasks.spec.ts              # Task CRUD and linking tests
  navigation.spec.ts         # Sidebar navigation tests
  fixtures.ts                # Shared test fixtures and helpers
  global-setup.ts            # Playwright global setup (login)
  global-teardown.ts         # Playwright global teardown

prisma/
  schema.prisma              # Database schema (4 models, 8 enums)
  seed.ts                    # Database seeding script
```

### Key Files

- `middleware.ts` -- Protects all routes except `/api`, `/_next`, `/favicon.ico`; redirects unauthenticated users to `/login`
- `playwright.config.ts` -- E2E test configuration
- `next.config.ts` -- Next.js configuration
- `tailwind.config.js` -- Tailwind with RTL support

### Authentication

- NextAuth.js v4 with credentials provider (email + password with bcrypt)
- JWT strategy with session tokens
- Middleware-based route protection (all non-API routes require auth)
- User ID extracted from session in API routes via `auth-handler.ts`

### Service Layer Pattern

Each service is a static class with methods that accept `userId` as the first parameter for data scoping:

```typescript
// Example pattern
class ContactsService {
  static async getAll(userId: string, filters?: ContactFilters): Promise<Contact[]>
  static async getById(userId: string, id: string): Promise<Contact | null>
  static async create(userId: string, data: CreateContactInput): Promise<Contact>
  static async update(userId: string, id: string, data: UpdateContactInput): Promise<Contact>
  static async delete(userId: string, id: string): Promise<void>
}
```

Services: `ContactsService`, `ProjectsService`, `TasksService`, `DashboardService`

### API Route Pattern

API routes use handler functions from `lib/api/`:

- `api-handler.ts` wraps route logic with error handling
- `auth-handler.ts` extracts authenticated user from the session
- All mutations validate input with Zod schemas from `lib/validations/`

### Frontend Pattern

- Pages are client components (`'use client'`) that fetch data via `lib/api/client.ts` (Axios)
- Forms use React Hook Form with Zod resolvers
- UI built with shadcn/ui components (Dialog modals for create/edit)
- Toast notifications via react-hot-toast
- All text in Hebrew, all layouts RTL

## Hebrew/RTL Support

- Full RTL layout with `dir="rtl"` and `lang="he"`
- All UI labels, messages, and validation errors in Hebrew
- Israeli date format (DD/MM/YYYY)
- Week starts on Sunday
- Currency in ILS (formatted with toLocaleString)

## Environment Configuration

Required environment variables:

- `DATABASE_URL` -- PostgreSQL connection string (Supabase pooled)
- `DIRECT_URL` -- Direct database URL for migrations
- `NEXTAUTH_SECRET` -- JWT encryption secret
- `NEXTAUTH_URL` -- Application URL for auth callbacks

## E2E Testing

43 Playwright tests across 6 spec files covering:

- Authentication (login, registration)
- Dashboard (KPIs, data display)
- Contacts (CRUD, lead-to-client conversion, phase filtering)
- Projects (CRUD, status transitions, delete protection when tasks exist)
- Tasks (CRUD, project linking, standalone tasks, inline completion)
- Navigation (sidebar links)

Tests use a shared global setup that logs in once and stores auth state. Test fixtures in `e2e/fixtures.ts` provide seeded data helpers.

Run with: `npm run test:e2e`

## Code Patterns to Follow

- **Services**: Static classes in `lib/services/`, always scope queries by `userId`
- **API Routes**: Use `auth-handler.ts` to get the authenticated user, validate with Zod
- **Forms**: React Hook Form + Zod schemas, Dialog modals for create/edit
- **Error Handling**: Hebrew error messages with toast notifications
- **UI Components**: shadcn/ui with consistent RTL styling
- **Immutability**: Never mutate objects; use spread operator for updates
- **Contact phases**: Use the `phase` filter (lead/client) rather than separate models

## Codebase Metrics

- ~74 TypeScript files
- 4 database models, 8 enums
- 4 service classes
- 9 API route files (7 resource routes + 2 auth routes)
- 6 dashboard pages (+ detail pages for contacts and projects)
- 43 E2E tests across 6 spec files
- 23 shadcn/ui components

## Legacy Context

The `claude-context/` directory contains planning documents from the original 12-model design. These documents describe the old architecture (leads, clients, payments, activities, notifications, milestones, documents as separate models) and are outdated. The current system uses the simplified 4-model architecture described above. Do not rely on those documents for understanding the current codebase.
