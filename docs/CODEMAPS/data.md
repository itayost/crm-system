# Data Codemap

Freshness: 2026-03-26 | Models: 4 | Enums: 8

## Schema: prisma/schema.prisma

```
User (1) ---< Contact (1) ---< Project (1) ---< Task
                                   |
User (1) -------------------------+
User (1) ------------------------------------------+-- Task
```

## Models

### User
| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| email | String | unique |
| password | String | bcrypt hash |
| name | String | |
| role | UserRole | default OWNER |

### Contact
| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| name, phone | String | required |
| email, company, address, taxId, notes | String? | optional |
| status | ContactStatus | default NEW |
| source | ContactSource | required |
| estimatedBudget | Decimal(10,2)? | |
| projectType | String? | |
| isVip | Boolean | default false |
| convertedAt | DateTime? | auto-set on CLIENT |
| userId | String | FK -> User |
| **indexes** | status, createdAt | |

### Project
| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| name | String | required |
| description | Text? | |
| type | ProjectType | required |
| status | ProjectStatus | default DRAFT |
| priority | Priority | default MEDIUM |
| startDate, deadline, completedAt | DateTime? | |
| price | Decimal(10,2)? | one-time |
| retention | Decimal(10,2)? | recurring |
| retentionFrequency | RetentionFrequency? | MONTHLY/YEARLY |
| contactId | String | FK -> Contact |
| userId | String | FK -> User |
| **indexes** | status, deadline | |

### Task
| Column | Type | Notes |
|--------|------|-------|
| id | String (cuid) | PK |
| title | String | required |
| description | Text? | |
| status | TaskStatus | default TODO |
| priority | Priority | default MEDIUM |
| dueDate, completedAt | DateTime? | |
| projectId | String? | FK -> Project (nullable = standalone task) |
| userId | String | FK -> User |
| **indexes** | projectId, status | |

## Enums

| Enum | Values |
|------|--------|
| UserRole | OWNER, ADMIN, USER |
| ContactStatus | NEW, CONTACTED, QUOTED, NEGOTIATING, CLIENT, INACTIVE |
| ContactSource | WEBSITE, PHONE, WHATSAPP, REFERRAL, OTHER |
| ProjectType | LANDING_PAGE, WEBSITE, ECOMMERCE, WEB_APP, MOBILE_APP, MANAGEMENT_SYSTEM, CONSULTATION |
| ProjectStatus | DRAFT, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED |
| Priority | LOW, MEDIUM, HIGH, URGENT |
| TaskStatus | TODO, IN_PROGRESS, COMPLETED, CANCELLED |
| RetentionFrequency | MONTHLY, YEARLY |

## Phase Logic (service-level, not schema)

- Lead statuses: NEW, CONTACTED, QUOTED, NEGOTIATING
- Client statuses: CLIENT, INACTIVE
- Filtered via ContactsService `phase` filter param
