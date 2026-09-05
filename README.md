# HR Management System

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38B2AC?logo=tailwind-css&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14%2B-336791)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white)
![Flutter](https://img.shields.io/badge/Flutter-3-02569B?logo=flutter&logoColor=white)
![Dart](https://img.shields.io/badge/Dart-3-0175C2?logo=dart&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

> Enterprise HR Management System for institutional administration featuring real-time attendance tracking, employee management, leave workflows, and role-based access control across web and mobile platforms.

## Overview

A full-stack HR administration system built with a single API layer shared by web and mobile applications. Every write action is enforced server-side by role-based permissions and logged to a permanent audit trail — no database access from clients.

Built around real institutional requirements, the system covers employee management, real-time location-based attendance tracking, leave management with configurable balance tracking, approval workflows, and comprehensive audit logging. Holiday and weekly-off aware calculations ensure accurate attendance records.

## Why This Architecture

**Single API, Multiple Clients**
A shared API layer lets the mobile app plug into the exact same endpoints already built and tested for web — zero duplicated backend logic.

**No Direct Database Access**
Every read and write routes through an authenticated API layer. Access rules are enforced in one place, not scattered across UI code.

**Server-Enforced Permissions**
Admin-only actions are validated at the API level — rejecting unauthorized requests even if the UI were bypassed entirely. Not just hidden buttons.

**Audit Logging Built-In**
From day one, every create/update/delete/approval writes to a permanent, queryable audit trail. Compliance and accountability by design.

**JWT Authentication**
Chosen specifically for mobile compatibility — cookies won't work on Flutter, but JWT requires no backend rewrite. Future clients just need the token.

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
- - **Bulk data import** — Excel-based bulk upload for employees and holidays, with downloadable templates and row-level validation before import
- **Input validation layer** — RFC-compliant email validation, password strength enforcement with secure auto-generation, and India-formatted phone validation
- **Session security** — refresh-token-based sessions with revocation support
- **Rate limiting** — protection against abuse on sensitive endpoints, alongside standard security headers
- **Fine-grained permissions** — Control view, add, edit, delete per module
- **UserType-based roles** — Create custom roles with specific permission sets
- **Permission inheritance** — Parent module permissions apply to children
  - Example: "Masters.view" grants view access to all masters modules
  - Example: "Approvals.edit" grants edit access to Approve/Reject Requests
- **Access Control dashboard** — Manage roles, permissions, and user assignments
- **Nested permissions** — Approvals has sub-actions: Approve Requests, Reject Requests
- **Audit logging** — Every permission check logged with user, action, result

### Permission Modules

| Module | Actions | Sub-modules |
|---|---|---|
| Employee | view, add, edit, delete | Employee List, Employee Details |
| Attendance | view, add, edit | Check-in, Daily, Corrections |
| Masters | view, add, edit, delete | Departments, Designations, Holidays, Leave Types |
| Approvals | view, add, edit | Leave Approvals, Attendance Approvals, Approve Requests, Reject Requests |
| Leaves | view, add, edit | Leave Config, Balances |
| Reports | view, export | Attendance Summary, Consolidated Report |
| Dashboard | view | - |
| Access Control | view, add, edit, delete | User Types, Permissions |

### How It Works

1. **Admin** creates a UserType (e.g., "HR Manager")
2. **Admin** assigns granular permissions to that UserType
3. **Admin** assigns UserType to employees
4. **Employee** logs in → gets only their assigned permissions
5. **API** enforces permission on every endpoint
6. **Audit** logs every permission check (success/denial)

   
## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| Database | [PostgreSQL](https://www.postgresql.org) |
| ORM | [Prisma 7](https://www.prisma.io) (with driver adapters) |
| Auth | JWT ([jose](https://github.com/panva/jose)) + httpOnly cookies |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Password Hashing | bcryptjs |
| Access Control | Permission modules, UserType, fine-grained checks |

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
   git clone https://github.com/AyushJare/HR_System_Web.git
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

8. Login as admin and create your first UserType
   - Go to Admin → Access Control
   - Create new UserType
   - Assign permissions
   - Assign to employees

### Default Seeded Login

| Field | Value |
|---|---|
| Email | `admin@company.com` |
| Password | `Admin@123` |

Change this immediately in any environment beyond local development.

## Project Structure
```text
app/admin/
├── access-control/          NEW: Manage roles & permissions
│   ├── page.tsx            List UserTypes
│   ├── add/page.tsx        Create new role
│   └── [id]/edit/page.tsx  Edit permissions
│   ├── dashboard/           Live stats, pending approvals, recent activity
│   ├── employees/           List, add, per-employee detail + edit
│   ├── attendance/          Daily attendance marking
│   ├── masters/             Departments, Designations, Employee Types, Holidays, Leave Types, Weekly Off
│   ├── approvals/           Leave & attendance correction review queue
│   ├── audit-log/           Full system activity log
│   ├── reports/             Summary & consolidated attendance reports
│   └── AdminShell.tsx       Sidebar navigation shell
│
├── api/
│   ├── auth/                Login, logout, me
│   ├── employees/           CRUD + attendance summary
│   ├── departments/         Department management
│   ├── designations/        Designation management
│   ├── employee-types/      Employee type management
│   ├── holidays/            Holiday management
│   ├── leave-types/         Leave type management
│   ├── attendance/          Attendance management
│   ├── attendance-settings/ Attendance configuration
│   ├── approvals/           Leave & attendance correction approvals
│   ├── leave-balances/      Leave balance management
│   ├── audit-logs/          Full system activity logs
│   ├── reports/             Attendance & leave reports
│   └── dashboard/           Dashboard statistics
│
└── login/                   Login page

lib/
├── prisma.ts                Shared Prisma client (driver adapter)
├── auth.ts                  Session + requireAdmin() guard
├── jwt.ts                   Sign/verify JWT
├── password.ts              bcrypt hash/verify
├── dateOnly.ts              UTC-safe date parsing
└── leaveBalance.ts          Leave balance lookup/creation

prisma/
├── schema.prisma            Database schema (11 models)
└── seed.ts                  Initial admin seed script
```

## Auth & Security ✅

- **JWT-based authentication** — access tokens (1h) + refresh tokens (7d) with revocation
- **Session management** — secure DB-backed sessions, invalidate on logout
- **Works for both web and mobile** — httpOnly cookies for web, JWT headers for mobile

## Roadmap / Future Scope

- **Mobile app** — employee self-service check-in/check-out, reusing the existing API
- **GPS-based attendance verification** — geofenced check-in with fraud detection (mock-location, impossible-travel checks), integrating with the existing Approval workflow for flagged check-ins
- **Security hardening** — rate limiting on authentication and a password reset flow before any production deployment
- **Employee self-service portal** — leave requests and attendance corrections submitted directly by employees, not just admin-managed

## Known Limitations

--> No automated tests — reasonable for the current build stage, but real test coverage is needed before production, given the system handles employee PII
--> No password reset flow — admin must currently reset credentials manually via the database
--> Local PostgreSQL only — no managed hosting or automated backup strategy configured yet
--> Admin-managed attendance marking — until employee self-service exists, all attendance is entered by an admin rather than self-reported



📱 Applications
Web Application

Tech Stack: Next.js, React, TypeScript, Tailwind CSS, PostgreSQL, Prisma ORM

Location: Repository root

Run:/n

bash/n
npm install/n
npm run dev

Deploy: Vercel (automatic cron job support)

Mobile App Setup
1. Navigate to Mobile App/n
bash/n
cd hr_system_mobile
2. Install Dependencies/n
bash/n
flutter pub get/n
3. Environment Configuration/n

Create .env file in mobile app root with API endpoint:/n

env/n
API_URL=http://your-api-url.com/n
4. Run on Device/Emulator/n
bash/n
# For Android
flutter run -d android

# For iOS
flutter run -d ios

# For Web
flutter run -d chrome
5. Build Release
bash
# Android APK
flutter build apk

# iOS
flutter build ios

# Web
flutter build web


## License

This project is licensed under the MIT License — see [LICENSE](LICENSE) for details.
