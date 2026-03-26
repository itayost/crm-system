# Architecture Codemap

Freshness: 2026-03-26 | Files: ~60 TS/TSX (app+lib+components)

## System Diagram

```
Browser (RTL/Hebrew)
  |
  +-- middleware.ts .............. JWT gate (next-auth/jwt getToken)
  |     matcher: /((?!api|_next|favicon|public).*)
  |     auth pages -> dashboard redirect
  |     protected pages -> /login redirect
  |
  +-- app/(auth)/login .......... Public login page
  |
  +-- app/(dashboard)/ .......... Protected layout group
  |     layout.tsx .............. Sidebar + Header shell
  |     page.tsx ................ Dashboard (KPIs, recent data)
  |     contacts/, projects/, tasks/
  |
  +-- app/api/ .................. REST endpoints
  |     auth/[...nextauth] ..... NextAuth handler
  |     auth/register .......... User registration
  |     contacts/, projects/, tasks/, dashboard/
  |
  +-- lib/services/ ............. Business logic (static classes)
  |     ContactsService, ProjectsService, TasksService, DashboardService
  |
  +-- lib/api/api-handler.ts .... withAuth wrapper (session + error handling)
  |
  +-- prisma/schema.prisma ...... 4 models: User, Contact, Project, Task
  |
  +-- PostgreSQL (Supabase)
```

## Data Flow

```
Client (axios) -> API Route -> withAuth(session check) -> Service -> Prisma -> PostgreSQL
```

## Key Boundaries

- **Auth**: middleware.ts (page protection) + withAuth() (API protection)
- **Validation**: Zod schemas in lib/validations/ parsed in API routes
- **Services**: Stateless static classes, all methods take userId as first arg
- **State**: No global client state store used in redesign; pages fetch directly
