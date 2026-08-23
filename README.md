# HR Management System

> A role-based HR management platform built for a real institution's admin workflows — employee records, attendance, leave, and approvals in one auditable system.

## Overview

This is a full-stack HR administration system built with Next.js and PostgreSQL, designed around a single API layer that both the web admin panel and a future mobile app will share — no client ever touches the database directly. Every write action is enforced server-side by role and logged to a permanent audit trail, not just hidden behind UI buttons.

The system was built from a real internal architecture spec (employee management, attendance, masters, approvals, audit logging, reporting) and has grown to include configurable leave-type balance tracking, weekly-off/holiday-aware attendance calculations, and per-employee monthly attendance views.

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

Both the web admin panel and a planned future mobile app are designed as clients of a single API layer (Next.js Route Handlers). Neither client queries the database directly — every read and write goes through an authenticated, role-checked API route. This means access rules, audit logging, and business logic (like leave balance enforcement) live in exactly one place, regardless of which client is calling them.

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
  admin/          Admin panel pages (employees, attendance, masters, approvals, reports, dashboard)
  api/            All backend API routes
  login/          Login page
lib/              Shared utilities (Prisma client, auth, JWT, date handling)
prisma/
  schema.prisma   Database schema
  seed.ts         Initial admin seed script
  
## Roadmap / Future Scope

- **Mobile app** — employee self-service check-in/check-out, reusing the existing API
- **GPS-based attendance verification** — geofenced check-in with fraud detection (mock-location, impossible-travel checks), integrating with the existing Approval workflow for flagged check-ins
- **Security hardening** — rate limiting on authentication, refresh tokens, and a password reset flow before any production deployment
- **Employee self-service portal** — leave requests and attendance corrections submitted directly by employees, not just admin-managed

## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.