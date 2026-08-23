# HR Management System
https://img.shields.io/badge/Next.js-16-black
https://img.shields.io/badge/TypeScript-5-blue
https://img.shields.io/badge/PostgreSQL-14+-336791
https://img.shields.io/badge/Prisma-7-2D3748
https://img.shields.io/badge/license-MIT-green

> A role-based HR management platform built for a real institution's admin workflows — employee records, attendance, leave, and approvals in one auditable system.

## Overview

This is a full-stack HR administration system built with Next.js and PostgreSQL, designed around a single API layer that both the web admin panel and a future mobile app will share — no client ever touches the database directly. Every write action is enforced server-side by role and logged to a permanent audit trail, not just hidden behind UI buttons.

The system was built from a real internal architecture spec (employee management, attendance, masters, approvals, audit logging, reporting) and has grown to include configurable leave-type balance tracking, weekly-off/holiday-aware attendance calculations, and per-employee monthly attendance views.

## Why This Architecture

Single API, multiple future clients — a mobile app can plug into the exact same endpoints already built and tested for web, with zero duplicated backend logic.
No client ever touches the database directly — every read and write is routed through an authenticated API layer, so access rules are enforced in exactly one place, not scattered across UIs.
Server-enforced role checks, not UI-hidden buttons — an admin-only action rejects unauthorized requests at the API level, verified even if the UI were bypassed entirely.
Audit logging built into the schema from day one — every create/update/delete/approval writes to a permanent, queryable audit trail.
JWT over cookie-only sessions — chosen specifically so a future mobile client (which can't use browser cookies) requires no rewrite of the auth system.

## Key Features

- **Role-based access control** — JWT-based auth with httpOnly cookies; every admin-only action (creating/deleting employees, approving leave) is enforced server-side, not just hidden in the UI
- **Employee management** — full CRUD with soft-delete (no data is ever truly lost), searchable list, and a detailed per-employee monthly attendance view
- **Attendance tracking** — daily marking with automatic exclusion of weekly-off days and public holidays from absence calculations
- **Leave management** — configurable leave types (Casual/Earned/Sick) with real per-employee balance tracking; approving a leave automatically updates attendance and decrements the correct balance, wrapped in a transaction to prevent race conditions
- **Approvals workflow** — leave requests and attendance corrections route through a single review queue
- **Audit log** — every create/update/delete/approval across the system is tracked with who, what, and when
- **Masters configuration** — departments, designations, employee types, holidays, and weekly-off days are all admin-configurable, not hardcoded
- **Reports** — per-employee summary totals and a full monthly consolidated attendance grid
- **Admin dashboard** — live headcount, today's attendance breakdown (correctly blank on week-offs/holidays), pending approvals, upcoming holidays, and recent activity

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Database | [PostgreSQL](https://www.postgresql.org) |
| ORM | [Prisma 7](https://www.prisma.io) (with driver adapters) |
| Auth | JWT ([jose](https://github.com/panva/jose)) + httpOnly cookies |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Password Hashing | bcryptjs |

## Architecture

Driver-adapter Prisma Client — required by Prisma 7; connection pooling handled through a single shared client instance
jose over jsonwebtoken — works natively in both Node and Edge runtimes, avoiding a rewrite if auth checks move into Middleware later
bcryptjs over bcrypt — pure JavaScript, no native compilation step required at install time
Computed, not stored, attendance status — weekly-off and holiday exclusions are calculated at read-time against admin-configurable rules, not pre-written per day
Transaction-wrapped leave approval — approving a leave, updating attendance, and decrementing the leave balance happen atomically, preventing race conditions on shared balances

## Getting Started

### Prerequisites

- Node.js 20.19+, 22.12+, or 24+
- PostgreSQL 14+

### Installation

1. Clone the repository
```bash
   git clone https://github.com/AyushJare/HR_Management_System_Web.git
   cd HR_Management_System_Web
```

2. Install dependencies
```bash
   npm install
```

3. Configure environment variables — copy the example file and fill in your own values
```bash
   cp .env.example .env
```

4. Run database migrations
```bash
   npx prisma migrate dev
```

5. Seed the first admin account
```bash
   npx tsx prisma/seed.ts
```

6. Start the development server
```bash
   npm run dev
```

7. Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to the login page.

### Default Seeded Login

| Field | Value |
|---|---|
| Email | `admin@company.com` |
| Password | `Admin@123` |

Change this immediately in any environment beyond local development.

## Project Structure

app/
├── admin/
│   ├── dashboard/           Live stats, pending approvals, recent activity
│   ├── employees/           List, add, per-employee detail + edit
│   ├── attendance/          Daily attendance marking
│   ├── masters/             Departments, Designations, Employee Types, Holidays, Leave Types, Weekly Off
│   ├── approvals/           Leave & attendance correction review queue
│   ├── audit-log/           Full system activity log
│   ├── reports/             Summary & consolidated attendance reports
│   └── AdminShell.tsx       Sidebar navigation shell
├── api/
│   ├── auth/                login, logout, me
│   ├── employees/           CRUD + attendance-summary
│   ├── departments/         designations/ employee-types/ holidays/ leave-types/
│   ├── attendance/          attendance-settings/
│   ├── approvals/           leave-balances/
│   ├── audit-logs/          reports/  dashboard/
└── login/                   Login page

lib/
├── prisma.ts                Shared Prisma client (driver adapter)
├── auth.ts                  Session + requireAdmin() guard
├── jwt.ts                   Sign/verify JWT
├── password.ts              bcrypt hash/verify
├── dateOnly.ts               UTC-safe date parsing
└── leaveBalance.ts           Leave balance lookup/creation

prisma/
├── schema.prisma            Database schema (11 models)
└── seed.ts                  Initial admin seed script


## Roadmap / Future Scope

- **Mobile app** — employee self-service check-in/check-out, reusing the existing API
- **GPS-based attendance verification** — geofenced check-in with fraud detection (mock-location, impossible-travel checks), integrating with the existing Approval workflow for flagged check-ins
- **Security hardening** — rate limiting on authentication, refresh tokens, and a password reset flow before any production deployment
- **Employee self-service portal** — leave requests and attendance corrections submitted directly by employees, not just admin-managed

## Known Limitations

--> No automated tests — reasonable for the current build stage, but real test coverage is needed before production, given the system handles employee PII
--> No rate limiting or refresh tokens yet — tracked in the security hardening phase above
--> No password reset flow — admin must currently reset credentials manually via the database
--> Local PostgreSQL only — no managed hosting or automated backup strategy configured yet
--> Admin-managed attendance marking — until employee self-service exists, all attendance is entered by an admin rather than self-reported

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
