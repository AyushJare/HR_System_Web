HR Management System

Show Image Show Image Show Image Show Image Show Image

A role-based HR management platform built for a real institution's admin workflows — employee records, attendance, leave, and approvals in one auditable system.

Overview

A full-stack HR administration system built with Next.js and PostgreSQL, designed around a single API layer that both the web admin panel and a future mobile app will share — no client ever touches the database directly. Every write action is enforced server-side by role and logged to a permanent audit trail, not just hidden behind UI buttons.

Built from a real internal architecture spec (employee management, attendance, masters, approvals, audit logging, reporting), and grown to include configurable leave-type balance tracking, weekly-off/holiday-aware attendance calculations, and per-employee monthly attendance views.

Why This Architecture
Single API, multiple future clients — a mobile app can plug into the exact same endpoints already built and tested for web, with zero duplicated backend logic.
No client ever touches the database directly — every read and write is routed through an authenticated API layer, so access rules are enforced in exactly one place, not scattered across UIs.
Server-enforced role checks, not UI-hidden buttons — an admin-only action rejects unauthorized requests at the API level, verified even if the UI were bypassed entirely.
Audit logging built into the schema from day one — every create/update/delete/approval writes to a permanent, queryable audit trail.
JWT over cookie-only sessions — chosen specifically so a future mobile client (which can't use browser cookies) requires no rewrite of the auth system.
Key Features
Role-based access control — JWT auth with httpOnly cookies; every admin-only action is enforced server-side
Employee management — full CRUD with soft-delete, searchable list, and a detailed per-employee monthly attendance view
Attendance tracking — daily marking with automatic exclusion of weekly-off days and public holidays from absence calculations
Leave management — configurable leave types (Casual/Earned/Sick) with real per-employee balance tracking; approving a leave automatically updates attendance and decrements the correct balance inside a database transaction
Approvals workflow — leave requests and attendance corrections route through a single review queue
Audit log — every action tracked with who, what, and when
Masters configuration — departments, designations, employee types, holidays, and weekly-off days are all admin-configurable
Reports — per-employee summary totals and a full monthly consolidated attendance grid
Admin dashboard — live headcount, today's attendance breakdown, pending approvals, upcoming holidays, and recent activity
Tech Stack
Layer	Technology
Framework	Next.js 16 (App Router)
Database	PostgreSQL
ORM	Prisma 7 (with driver adapters)
Auth	JWT (jose) + httpOnly cookies
Styling	Tailwind CSS
Password Hashing	bcryptjs
Architecture Highlights
Driver-adapter Prisma Client — required by Prisma 7; connection pooling handled through a single shared client instance
jose over jsonwebtoken — works natively in both Node and Edge runtimes, avoiding a rewrite if auth checks move into Middleware later
bcryptjs over bcrypt — pure JavaScript, no native compilation step required at install time
Computed, not stored, attendance status — weekly-off and holiday exclusions are calculated at read-time against admin-configurable rules, not pre-written per day
Transaction-wrapped leave approval — approving a leave, updating attendance, and decrementing the leave balance happen atomically, preventing race conditions on shared balances
Getting Started
Prerequisites
Node.js 20.19+, 22.12+, or 24+
PostgreSQL 14+
Installation
Clone the repository
bash
   git clone https://github.com/AyushJare/HR_System_Web.git
   cd HR_System_Web
Install dependencies
bash
   npm install
Configure environment variables
bash
   cp .env.example .env
Run database migrations
bash
   npx prisma migrate dev
Seed the first admin account
bash
   npx tsx prisma/seed.ts
Start the development server
bash
   npm run dev
Open http://localhost:3000 — you'll be redirected to the login page.
Default Seeded Login
Field	Value
Email	admin@company.com
Password	Admin@123

Change this immediately in any environment beyond local development.

Project Structure
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
Project Statistics
Metric	Count
Database models	11 (Employee, Department, Designation, EmployeeType, Holiday, Attendance, Approval, LeaveType, LeaveBalance, AuditLog, AttendanceSettings)
API route files	24
Admin pages	10 top-level pages, 6 Masters sub-tabs
Core modules	9 (Auth, Employees, Attendance, Masters, Leave Types, Approvals, Audit Log, Reports, Dashboard)
Roadmap / Future Scope
Phase 1 — Mobile & Location-Based Attendance
 Mobile app (employee self-service), reusing the existing API
 GPS geofence-based check-in/check-out with configurable office radius
 Fraud detection (mock-location, impossible-travel checks), routed into the existing Approval workflow for flagged check-ins
 Server-timestamped check-in/out (never client-supplied) to prevent time manipulation
Phase 2 — Security Hardening
 Rate limiting on the login endpoint
 Refresh tokens for longer-lived sessions
 Password reset flow
 Secrets rotation before any shared/production deployment
Phase 3 — Employee Self-Service
 Employee-facing portal for submitting leave requests and attendance corrections directly
 Self-scoped API access (employees can only act on their own records, enforced server-side)
Known Limitations
No automated tests — reasonable for the current build stage, but real test coverage is needed before production, given the system handles employee PII
No rate limiting or refresh tokens yet — tracked in the security hardening phase above
No password reset flow — admin must currently reset credentials manually via the database
Local PostgreSQL only — no managed hosting or automated backup strategy configured yet
Admin-managed attendance marking — until employee self-service exists, all attendance is entered by an admin rather than self-reported
License

This project is licensed under the MIT License — see LICENSE for details.
