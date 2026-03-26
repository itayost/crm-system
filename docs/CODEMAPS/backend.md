# Backend Codemap

Freshness: 2026-03-26 | Files: 19 (API routes + services + middleware)

## API Routes

| Method | Path | Handler | Service |
|--------|------|---------|---------|
| POST | /api/auth/[...nextauth] | NextAuth | auth.config.ts |
| POST | /api/auth/register | register | prisma direct |
| GET/POST | /api/contacts | list/create | ContactsService |
| GET/PUT/DELETE | /api/contacts/[id] | read/update/delete | ContactsService |
| GET/POST | /api/projects | list/create | ProjectsService |
| GET/PUT/DELETE | /api/projects/[id] | read/update/delete | ProjectsService |
| GET/POST | /api/tasks | list/create | TasksService |
| GET/PUT/DELETE | /api/tasks/[id] | read/update/delete | TasksService |
| GET | /api/dashboard | metrics | DashboardService |

## Middleware Chain

```
Request -> middleware.ts (JWT check via getToken)
        -> API Route handler
        -> withAuth() wrapper (getServerSession, ZodError catch)
        -> Service method (userId scoped)
        -> Prisma query
```

## Auth Wrappers (two variants)

- `lib/api/api-handler.ts` -- withAuth(handler) for routes with params (contacts/[id], etc.)
  Signature: `(req, { params, userId }) => NextResponse`
- `lib/api/auth-handler.ts` -- withAuth(handler) for paramless routes
  Signature: `(req, userId) => NextResponse`

## Services

| Service | File | Methods |
|---------|------|---------|
| ContactsService | lib/services/contacts.service.ts | getAll, getById, create, update, delete |
| ProjectsService | lib/services/projects.service.ts | getAll, getById, create, update, delete |
| TasksService | lib/services/tasks.service.ts | getAll, getById, create, update, delete |
| DashboardService | lib/services/dashboard.service.ts | getData |

## Validations

| File | Schemas |
|------|---------|
| lib/validations/contact.ts | createContactSchema, updateContactSchema |
| lib/validations/project.ts | createProjectSchema, updateProjectSchema |
| lib/validations/task.ts | createTaskSchema, updateTaskSchema |

All use Zod. Hebrew error messages. Israeli phone regex for contacts.

## Business Rules (enforced in services)

- Contact delete blocked if projects exist
- Project create requires contact.status === CLIENT
- Project delete blocked if tasks exist
- Setting contact to INACTIVE blocked if active projects exist
- completedAt auto-set on status change to COMPLETED (projects, tasks)
- convertedAt auto-set on status change to CLIENT (contacts)
