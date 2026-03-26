# E2E Testing Design

**Date:** 2026-03-25
**Status:** Approved
**Scope:** Comprehensive Playwright E2E tests for the redesigned CRM system

## Goal

Add full E2E test coverage for all 6 pages and 4 models of the CRM system using Playwright. Tests cover every CRUD operation, validation errors, edge cases, and business rules.

## Decisions

- **Framework:** Playwright
- **Auth strategy:** Login once via UI in global setup, save session cookie, reuse across all tests
- **Data strategy:** Seed shared baseline data at start, each test creates/cleans up its own additional data
- **Total:** 43 tests across 6 spec files

---

## Prerequisites

Before implementing tests, these code fixes are needed:

1. **API error forwarding:** Update `lib/api/api-handler.ts` `withAuth` to forward service-layer errors as 400 responses (currently swallows them as generic 500 "Internal server error"). Without this, business rule tests (delete blocked, inactive blocked, non-client blocked) will fail because the Hebrew error messages never reach the client.

2. **ContactsService INACTIVE check:** Update `lib/services/contacts.service.ts` to also check for `ON_HOLD` projects when blocking INACTIVE transition (currently only checks `DRAFT` and `IN_PROGRESS`, but the architecture spec says `ON_HOLD` should also block).

---

## Architecture

### File Structure

```
e2e/
  global-setup.ts          — seed DB + login + save auth state
  global-teardown.ts       — clean up all test data
  fixtures.ts              — shared helpers (form fillers, selectors, assertions)
  auth.spec.ts             — login/logout (3 tests)
  contacts.spec.ts         — contacts CRUD, filtering, status transitions (12 tests)
  projects.spec.ts         — projects CRUD, contact validation, status transitions (10 tests)
  tasks.spec.ts            — tasks CRUD, standalone vs project-linked, completion toggle (9 tests)
  dashboard.spec.ts        — KPIs display, quick actions, navigation (5 tests)
  navigation.spec.ts       — sidebar links, header, page transitions (4 tests)
playwright.config.ts       — Playwright configuration (project root)
```

### Playwright Configuration

- Base URL: `http://localhost:3000`
- Global setup/teardown scripts
- `storageState` for auth reuse
- Single browser (chromium) for dev speed; add webkit/firefox for CI later
- Screenshot on failure
- HTML reporter

### Auth Flow

1. `global-setup.ts` seeds a test user via direct Prisma call (bcrypt password)
2. Launches a browser, navigates to `/login`, fills credentials, submits
3. Saves cookies to `e2e/.auth/storageState.json`
4. All spec files load from this storage state — no login overhead
5. `auth.spec.ts` is the exception: it does NOT use saved state (tests login/logout directly)

---

## Test Data

### Seed Data (global-setup)

Created directly via Prisma (not through the UI) for speed and reliability. The seed user is distinct from any pre-existing demo users in the database.

| Entity | Key Fields | Purpose |
|--------|-----------|---------|
| User | email: e2e-test@test.com, password: password123 | Auth for all tests |
| Contact | name: "ליד ראשון", status: NEW, source: PHONE | Lead tab, conversion test |
| Contact | name: "ליד שני", status: QUOTED, source: WEBSITE | Lead tab |
| Contact | name: "לקוח פעיל", status: CLIENT | Project creation, detail page |
| Contact | name: "לקוח VIP", status: CLIENT, isVip: true | VIP display |
| Contact | name: "לקוח לא פעיל", status: INACTIVE | Filter testing |
| Project | name: "פרויקט אתר", status: DRAFT, price: 5000, type: WEBSITE, contact: "לקוח פעיל" | Project list, detail |
| Project | name: "פרויקט אפליקציה", status: IN_PROGRESS, price: 15000, type: WEB_APP, contact: "לקוח פעיל" | Active projects, dashboard |
| Task | title: "משימה ראשונה", status: TODO, priority: HIGH, project: "פרויקט אתר" | Task list, project detail |
| Task | title: "משימה עצמאית", status: TODO, priority: MEDIUM, no project | Standalone filter |
| Task | title: "משימה שהושלמה", status: COMPLETED, project: "פרויקט אתר" | Status filter |

### Cleanup Strategy

- Each test that creates entities deletes them via API (`page.request.delete(...)`) in an `afterEach` or at the end of the test
- `global-teardown.ts` deletes all seed data (tasks first, then projects, then contacts, then user) as a safety net
- IDs of created entities are tracked in variables for cleanup
- Cleanup only deletes records with IDs created by the seed — never deletes pre-existing data

---

## Test Coverage

### auth.spec.ts (3 tests)

| Test | Description |
|------|-------------|
| login-valid | Fill email/password, submit, verify redirect to dashboard |
| login-invalid | Wrong password, verify Hebrew error message shown |
| logout | Click logout in header user menu, verify redirect to login |

Does NOT use saved storageState. Each test starts from the login page. No register test — there is no public registration page (registration is admin-only via API).

### contacts.spec.ts (12 tests)

| Test | Description |
|------|-------------|
| list-shows-data | Navigate to /contacts, verify seeded contacts visible |
| filter-leads-tab | Click "לידים" tab, verify only lead-phase contacts shown |
| filter-clients-tab | Click "לקוחות" tab, verify only client-phase contacts shown |
| search | Type contact name in search, wait for debounce (300ms), verify filtered results |
| create-success | Open form dialog, fill valid data, submit, verify appears in list + success toast |
| create-validation | Submit empty form, verify Hebrew validation errors (name, phone) |
| view-detail-lead | Click lead contact row, verify detail page shows lead fields, projects section is NOT visible |
| view-detail-client | Click client contact row, verify detail page shows client fields, projects section IS visible with list |
| edit | Click edit on detail page, change name in dialog, save, verify updated |
| convert-to-client | On lead detail, click "המר ללקוח" button, verify status badge changes to CLIENT |
| delete-success | Create a new contact (no projects), delete it, verify removed from list |
| delete-blocked | Try to delete "לקוח פעיל" (has projects), verify Hebrew error toast |

### projects.spec.ts (10 tests)

| Test | Description |
|------|-------------|
| list-shows-data | Navigate to /projects, verify seeded projects visible |
| filter-by-status | Select status filter dropdown, verify list updates |
| create-success | Open form dialog, select "לקוח פעיל" as contact, fill price/retention, submit, verify in list |
| create-blocked-non-client | Try to create project with a lead-phase contact selected, verify error toast |
| create-validation | Submit with missing required fields (name, contact), verify Hebrew validation errors |
| view-detail | Click project, verify price shows as "5,000 ₪", retention info, contact link |
| edit | Edit price/deadline in dialog, save, verify updated |
| status-transitions | On project detail, click "התחל עבודה" button (DRAFT->IN_PROGRESS), then "סיים" button (->COMPLETED), verify status badge updates |
| delete-success | Create a project with no tasks, delete it via detail page, verify removed |
| delete-blocked | Try to delete "פרויקט אתר" (has tasks), verify Hebrew error toast |

### tasks.spec.ts (9 tests)

| Test | Description |
|------|-------------|
| list-shows-data | Navigate to /tasks, verify seeded tasks visible |
| filter-by-status | Select status filter, verify list updates |
| filter-standalone | Toggle standalone filter, verify only "משימה עצמאית" shown (no project) |
| create-with-project | Open form dialog, fill title, select project, submit, verify appears in list |
| create-standalone | Open form dialog, fill title, leave project empty, verify appears in list with "-" in project column |
| edit | Click task row to open edit dialog, change title/priority, save, verify updated |
| inline-completion | Click completion checkbox on a TODO task row, verify status changes to COMPLETED (optimistic update) |
| delete | Delete a task via direct API call (`page.request.delete`), verify removed from list on refresh |
| visible-in-project-detail | Navigate to /projects/[id] for "פרויקט אתר", verify "משימה ראשונה" appears in tasks section |

### dashboard.spec.ts (5 tests)

| Test | Description |
|------|-------------|
| kpi-cards | Verify 4 KPI cards render with numbers matching seed data (revenue, active projects, leads, pending tasks) |
| revenue-format | Verify revenue card displays amount in "X,XXX ₪" format (number first, then shekel symbol) |
| recent-contacts | Verify recent contacts section shows seeded contacts |
| active-projects | Verify active projects section shows seeded projects with deadline info |
| quick-actions | Click "איש קשר חדש" (navigates to /contacts), "פרויקט חדש" (navigates to /projects?new=true, opens form), "משימה חדשה" (navigates to /tasks) |

### navigation.spec.ts (4 tests)

| Test | Description |
|------|-------------|
| sidebar-links | Click each sidebar item (dashboard, contacts, projects, tasks), verify correct page loads by URL |
| active-highlight | Navigate to /contacts, verify contacts sidebar link has active styling (blue highlight) |
| header-greeting | Verify header shows one of the valid Hebrew greetings: match against regex `/בוקר טוב\|צהריים טובים\|ערב טוב\|לילה טוב/` |
| header-user-menu | Open user dropdown, verify "פרופיל" and "התנתק" menu items exist |

---

## Shared Helpers (fixtures.ts)

```typescript
// Form helpers — fill and submit forms via Dialog
createContact(page, { name, phone, source, ... })
createProject(page, { name, type, contactName, price, ... })
createTask(page, { title, priority, projectName?, ... })

// Toast assertions — uses react-hot-toast DOM selectors
// Toasts render in [role="status"] elements
expectToastSuccess(page, hebrewText)  // page.locator('[role="status"]').filter({ hasText })
expectToastError(page, hebrewText)    // same selector, error styling

// Selectors
getTableRow(page, containsText)  // find row in table by text content
getStatusBadge(page, text)       // find badge by Hebrew status label

// Formatting
formatILS(amount)                // 5000 -> "5,000 ₪" (number first, space, shekel symbol)

// Debounce handling
waitForSearchResults(page)       // waits for network response after search debounce (300ms)
```

---

## Configuration Notes

- `playwright.config.ts` starts dev server via `webServer: { command: 'npm run dev' }`
- Tests run against `localhost:3000`
- `.gitignore` should include `e2e/.auth/` (session state) and `test-results/` and `playwright-report/`
- `package.json` gets `test:e2e` script: `npx playwright test`
- App layout must include `<Toaster />` from `react-hot-toast` for toast assertions to work
- All search inputs use 300ms debounce — tests must use `waitForResponse` or the `waitForSearchResults` helper

---

## What's NOT Included

- CI/CD pipeline integration (can be added later)
- Visual regression testing
- Performance/load testing
- Mobile viewport testing (can add webkit/firefox later)
- API-level tests (the E2E tests cover API behavior through the UI)
- Public registration testing (no registration page exists)
