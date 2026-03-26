# Frontend Codemap

Freshness: 2026-03-26 | Files: 37 (pages + components)

## Page Tree

```
app/
  layout.tsx ........................ Root layout (RTL, Hebrew, Heebo font)
  globals.css ....................... Tailwind base styles
  (auth)/
    layout.tsx ...................... Centered auth layout
    login/page.tsx .................. Login form
  (dashboard)/
    layout.tsx ...................... Sidebar + Header + main content area
    page.tsx ........................ Dashboard (KPIs, recent contacts, active projects)
    contacts/
      page.tsx ...................... Contact list with filters (phase: lead/client)
      [id]/page.tsx ................. Contact detail + linked projects
    projects/
      page.tsx ...................... Project list with status/search filters
      [id]/page.tsx ................. Project detail + linked tasks
    tasks/
      page.tsx ...................... Task list with status/project filters
```

## Component Hierarchy

```
components/
  layout/
    header.tsx ...................... Top bar (user menu, search)
    sidebar.tsx ..................... Navigation links, badges
  forms/
    contact-form.tsx ................ Create/edit contact (React Hook Form + Zod)
    project-form.tsx ................ Create/edit project (React Hook Form + Zod)
    task-form.tsx ................... Create/edit task (React Hook Form + Zod)
  ui/ (shadcn/ui -- 21 components)
    alert-dialog, alert, avatar, badge, breadcrumb, button, card,
    dialog, dropdown-menu, empty-state, form, input, label, popover,
    progress, select, separator, skeleton, sonner, switch, table,
    tabs, textarea
```

## State Management

- **Server state**: Direct fetch in page components (no React Query in redesign)
- **Client HTTP**: axios instance at lib/api/client.ts (baseURL: /api, 401 redirect)
- **Forms**: React Hook Form + @hookform/resolvers/zod
- **Notifications**: Sonner toast (sonner component in ui/)
- **No global store**: Zustand dependency exists but not actively used in redesigned pages

## RTL/Hebrew

- Root html: `dir="rtl" lang="he"`
- Font: Heebo (Google Fonts via next/font)
- All labels, errors, placeholders in Hebrew
- Currency: ILS
