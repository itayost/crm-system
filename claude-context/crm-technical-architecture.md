# ארכיטקטורה טכנית - מערכת CRM

## 🏗️ Tech Stack

### Frontend
```
Framework: Next.js 14 (App Router)
Language: TypeScript
Styling: Tailwind CSS + shadcn/ui
State Management: Zustand
Forms: React Hook Form + Zod
Data Fetching: TanStack Query
Charts: Recharts
Icons: Lucide React
Date Handling: date-fns
```

### Backend
```
API: Next.js API Routes
Database: PostgreSQL (Supabase)
ORM: Prisma
Authentication: NextAuth.js
File Storage: Supabase Storage
Email Service: Resend
Cron Jobs: Vercel Cron
Validation: Zod
```

### DevOps
```
Hosting: Vercel
Database: Supabase
Monitoring: Vercel Analytics
Error Tracking: Sentry
CI/CD: GitHub Actions
```

## 📁 מבנה הפרויקט

```
crm-system/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── leads/
│   │   ├── clients/
│   │   ├── projects/
│   │   ├── tasks/
│   │   ├── time/
│   │   ├── payments/
│   │   └── reports/
│   └── api/
│       ├── auth/
│       ├── leads/
│       ├── clients/
│       ├── projects/
│       ├── tasks/
│       ├── time/
│       ├── payments/
│       ├── webhooks/
│       └── cron/
├── components/
│   ├── ui/           # shadcn components
│   ├── forms/
│   ├── charts/
│   ├── layout/
│   └── shared/
├── lib/
│   ├── db/
│   ├── auth/
│   ├── api/
│   ├── utils/
│   └── hooks/
├── prisma/
│   └── schema.prisma
├── types/
├── styles/
└── public/
```

## 🗄️ Database Schema (Prisma)

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// Users
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  password        String
  name            String
  role            UserRole  @default(OWNER)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  leads           Lead[]
  clients         Client[]
  projects        Project[]
  tasks           Task[]
  payments        Payment[]
  notifications   Notification[]
  timeEntries     TimeEntry[]
}

// Leads
model Lead {
  id              String    @id @default(cuid())
  name            String
  email           String?
  phone           String
  company         String?
  source          LeadSource
  status          LeadStatus @default(NEW)
  projectType     String?
  estimatedBudget Decimal?
  notes           String?
  
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  
  convertedToClientId String?
  convertedAt     DateTime?
  client          Client?   @relation(fields: [convertedToClientId], references: [id])
  
  activities      Activity[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([status])
  @@index([createdAt])
}

// Clients
model Client {
  id              String    @id @default(cuid())
  name            String
  email           String
  phone           String
  company         String?
  address         String?
  taxId           String?
  type            ClientType @default(REGULAR)
  status          ClientStatus @default(ACTIVE)
  notes           String?
  
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  
  projects        Project[]
  payments        Payment[]
  recurringPayments RecurringPayment[]
  leads           Lead[]
  
  totalRevenue    Decimal   @default(0)
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([status])
  @@index([type])
}

// Projects
model Project {
  id              String    @id @default(cuid())
  name            String
  description     String?
  type            ProjectType
  status          ProjectStatus @default(DRAFT)
  priority        Priority  @default(MEDIUM)
  stage           ProjectStage @default(PLANNING)
  
  startDate       DateTime?
  deadline        DateTime?
  completedAt     DateTime?
  
  estimatedHours  Int?
  actualHours     Float?
  budget          Decimal?
  
  clientId        String
  client          Client    @relation(fields: [clientId], references: [id])
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  
  tasks           Task[]
  payments        Payment[]
  timeEntries     TimeEntry[]
  milestones      Milestone[]
  documents       Document[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([status])
  @@index([deadline])
}

// Tasks
model Task {
  id              String    @id @default(cuid())
  title           String
  description     String?
  status          TaskStatus @default(TODO)
  priority        Priority  @default(MEDIUM)
  
  dueDate         DateTime?
  completedAt     DateTime?
  
  estimatedHours  Float?
  actualHours     Float?
  
  projectId       String
  project         Project   @relation(fields: [projectId], references: [id])
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  
  parentTaskId    String?
  parentTask      Task?     @relation("SubTasks", fields: [parentTaskId], references: [id])
  subTasks        Task[]    @relation("SubTasks")
  
  timeEntries     TimeEntry[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([projectId])
  @@index([status])
}

// Time Entries
model TimeEntry {
  id              String    @id @default(cuid())
  startTime       DateTime
  endTime         DateTime?
  duration        Int?      // in minutes
  description     String?
  
  taskId          String?
  task            Task?     @relation(fields: [taskId], references: [id])
  projectId       String
  project         Project   @relation(fields: [projectId], references: [id])
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([projectId])
  @@index([startTime])
}

// Payments
model Payment {
  id              String    @id @default(cuid())
  amount          Decimal
  status          PaymentStatus @default(PENDING)
  type            PaymentType
  
  dueDate         DateTime
  paidAt          DateTime?
  
  invoiceNumber   String?
  receiptNumber   String?
  notes           String?
  
  clientId        String
  client          Client    @relation(fields: [clientId], references: [id])
  projectId       String?
  project         Project?  @relation(fields: [projectId], references: [id])
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  
  recurringPaymentId String?
  recurringPayment RecurringPayment? @relation(fields: [recurringPaymentId], references: [id])
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([status])
  @@index([dueDate])
}

// Recurring Payments
model RecurringPayment {
  id              String    @id @default(cuid())
  name            String
  amount          Decimal
  frequency       Frequency
  nextDueDate     DateTime
  lastPaidDate    DateTime?
  isActive        Boolean   @default(true)
  serviceType     String
  reminderDays    Int       @default(30)
  
  clientId        String
  client          Client    @relation(fields: [clientId], references: [id])
  
  paymentHistory  Payment[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([nextDueDate])
}

// Notifications
model Notification {
  id              String    @id @default(cuid())
  type            NotificationType
  title           String
  message         String?
  isRead          Boolean   @default(false)
  
  entityType      String?
  entityId        String?
  
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  
  createdAt       DateTime  @default(now())
  
  @@index([userId, isRead])
}

// Activity Log
model Activity {
  id              String    @id @default(cuid())
  action          String
  entityType      String
  entityId        String
  
  leadId          String?
  lead            Lead?     @relation(fields: [leadId], references: [id])
  
  metadata        Json?
  
  createdAt       DateTime  @default(now())
  
  @@index([entityType, entityId])
}

// Documents
model Document {
  id              String    @id @default(cuid())
  name            String
  url             String
  type            String
  size            Int
  
  projectId       String?
  project         Project?  @relation(fields: [projectId], references: [id])
  
  createdAt       DateTime  @default(now())
}

// Milestones
model Milestone {
  id              String    @id @default(cuid())
  name            String
  description     String?
  dueDate         DateTime
  completedAt     DateTime?
  
  projectId       String
  project         Project   @relation(fields: [projectId], references: [id])
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

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

enum ClientType {
  REGULAR
  VIP
}

enum ClientStatus {
  ACTIVE
  INACTIVE
}

enum ProjectType {
  LANDING_PAGE
  WEBSITE
  ECOMMERCE
  WEB_APP
  MOBILE_APP
  MANAGEMENT_SYSTEM
  CONSULTATION
}

enum ProjectStatus {
  DRAFT
  IN_PROGRESS
  ON_HOLD
  COMPLETED
  CANCELLED
}

enum ProjectStage {
  PLANNING
  DEVELOPMENT
  TESTING
  REVIEW
  DELIVERY
  MAINTENANCE
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  WAITING_APPROVAL
  COMPLETED
  CANCELLED
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum PaymentStatus {
  PENDING
  PAID
  OVERDUE
  CANCELLED
}

enum PaymentType {
  PROJECT
  MAINTENANCE
  CONSULTATION
  OTHER
}

enum Frequency {
  MONTHLY
  QUARTERLY
  YEARLY
}

enum NotificationType {
  LEAD_NEW
  DEADLINE_APPROACHING
  PAYMENT_DUE
  PAYMENT_OVERDUE
  TASK_ASSIGNED
  PROJECT_UPDATE
  SYSTEM
}
```

## 🔌 API Endpoints Structure

### Authentication
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/session
POST   /api/auth/refresh
```

### Leads
```
GET    /api/leads                 
GET    /api/leads/[id]           
POST   /api/leads                
PUT    /api/leads/[id]           
DELETE /api/leads/[id]           
POST   /api/leads/[id]/convert   
```

### Clients
```
GET    /api/clients              
GET    /api/clients/[id]         
POST   /api/clients             
PUT    /api/clients/[id]         
DELETE /api/clients/[id]         
GET    /api/clients/[id]/projects
```

### Projects
```
GET    /api/projects             
GET    /api/projects/[id]        
POST   /api/projects            
PUT    /api/projects/[id]        
DELETE /api/projects/[id]        
GET    /api/projects/[id]/tasks  
POST   /api/projects/[id]/stage  
```

### Time Tracking
```
POST   /api/time/start          
POST   /api/time/stop           
GET    /api/time/entries        
POST   /api/time/manual         
PUT    /api/time/[id]           
DELETE /api/time/[id]           
```

### Payments
```
GET    /api/payments            
GET    /api/payments/[id]       
POST   /api/payments           
PUT    /api/payments/[id]       
DELETE /api/payments/[id]       
GET    /api/payments/recurring  
POST   /api/payments/recurring  
```

### Reports
```
GET    /api/reports/dashboard   
GET    /api/reports/time       
GET    /api/reports/revenue    
GET    /api/reports/projects   
```

### Webhooks
```
POST   /api/webhooks/lead      
POST   /api/webhooks/payment   
```

### Cron Jobs
```
GET    /api/cron/notifications 
GET    /api/cron/reminders    
GET    /api/cron/recurring    
```

## 🔐 Security Implementation

### Authentication Flow
```typescript
// NextAuth Configuration
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Validate credentials
        // Return user object or null
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
  pages: {
    signIn: '/login',
    error: '/auth/error',
  }
}
```

### API Protection
```typescript
// Middleware for protected routes
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })
  
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/protected/:path*']
}
```

## 🚀 Deployment Configuration

### Vercel Configuration
```json
// vercel.json
{
  "buildCommand": "prisma generate && next build",
  "installCommand": "npm install",
  "framework": "nextjs",
  "regions": ["tlv1"],
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 9 * * *"
    },
    {
      "path": "/api/cron/reminders",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/cron/recurring",
      "schedule": "0 0 1 * *"
    }
  ]
}
```

### Environment Variables
```bash
# .env.local
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="https://your-domain.com"
WHATSAPP_API_KEY="..."
WHATSAPP_PHONE_ID="..."
WEBHOOK_SECRET="..."
RESEND_API_KEY="..."
SENTRY_DSN="..."
```

## 📱 WhatsApp Integration

### Setup
```typescript
// lib/whatsapp.ts
import axios from 'axios'

const WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0'
const PHONE_ID = process.env.WHATSAPP_PHONE_ID
const TOKEN = process.env.WHATSAPP_API_KEY

export async function sendWhatsAppMessage(
  to: string,
  message: string
) {
  try {
    const response = await axios.post(
      `${WHATSAPP_API_URL}/${PHONE_ID}/messages`,
      {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      },
      {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    )
    return response.data
  } catch (error) {
    console.error('WhatsApp send error:', error)
    throw error
  }
}
```

## 🎨 UI Components Structure

### Component Hierarchy
```
<DashboardLayout>
  <Sidebar />
  <Header />
  <MainContent>
    <PageHeader />
    <DataTable />
    <Filters />
    <Actions />
  </MainContent>
  <NotificationPanel />
</DashboardLayout>
```

### State Management (Zustand)
```typescript
// stores/useAppStore.ts
interface AppStore {
  // User
  user: User | null
  setUser: (user: User) => void
  
  // UI State
  sidebarOpen: boolean
  toggleSidebar: () => void
  
  // Notifications
  notifications: Notification[]
  addNotification: (notification: Notification) => void
  
  // Active Timer
  activeTimer: TimeEntry | null
  startTimer: (taskId: string) => void
  stopTimer: () => void
}
```

## 📊 Performance Optimization

### Database
- Indexed fields for common queries
- Query optimization with Prisma
- Connection pooling
- Pagination for large datasets

### Frontend
- Code splitting with Next.js dynamic imports
- Image optimization with next/image
- Static generation where possible
- Client-side caching with React Query
- Virtual scrolling for long lists

### API
- Response caching with proper headers
- Rate limiting
- Background job processing for heavy tasks
- Webhook queuing

## 🧪 Testing Strategy

### Unit Tests
```typescript
// __tests__/api/leads.test.ts
describe('Leads API', () => {
  test('should create a new lead', async () => {
    // Test implementation
  })
})
```

### Integration Tests
```typescript
// __tests__/integration/lead-conversion.test.ts
describe('Lead Conversion Flow', () => {
  test('should convert lead to client', async () => {
    // Test implementation
  })
})
```

### E2E Tests
```typescript
// e2e/dashboard.spec.ts
test('Dashboard loads correctly', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveTitle(/Dashboard/)
})
```