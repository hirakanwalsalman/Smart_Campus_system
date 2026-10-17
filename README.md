# Smart Campus Issue Reporting and Equipment Maintenance System

A responsive web application for reporting campus equipment problems and tracking their repair. Built as a learning and portfolio project, with a structure that can later be extended to biomedical equipment management.

> **Status:** work in progress. Stage 1 (core prototype) is complete.

## Features (Stage 1)

- Sign up, log in and log out, with three roles: **Student/Staff**, **Technician** and **Admin**
- **Equipment register:** add and edit equipment with a unique ID, category, location and status; search and filter the list
- **Issue reporting:** report a problem with a description, priority and an optional photo
- **Complaint tracking:** Pending, In progress and Resolved statuses, with an automatic resolved date
- **Role-based dashboard** with live statistics and a list of recent complaints
- **Role-based access:** students see only their own complaints; admins see everything and manage equipment and statuses
- Private photo storage with per-user access rules
- Responsive layout with a navigation bar and a phone menu

## Planned

- **Stage 2:** technician assignment, repair notes and maintenance history
- **Stage 3:** preventive maintenance schedule, admin dashboard charts and analytics
- **Stage 4:** downloadable PDF reports
- **Optional:** AI-assisted complaint categorisation (Google Gemini), QR codes, notifications, and a biomedical equipment mode (calibration and safety-test tracking)

## Tech stack

- [Next.js](https://nextjs.org/) (App Router) and React
- [Tailwind CSS](https://tailwindcss.com/)
- [Lucide](https://lucide.dev/) icons
- [Supabase](https://supabase.com/): PostgreSQL database, authentication and file storage

## Security

- Row Level Security is enabled on every table, so access rules are enforced by the database itself
- Users cannot change their own role; only an admin can promote accounts
- Complaint photos are stored in a private bucket, and each user can only upload into their own folder
- Secret settings live in `.env.local`, which is excluded from Git

## Getting started

### 1. Clone and install

```bash
git clone https://github.com/hirakanwalsalman/Smart_Campus_system.git
cd Smart_Campus_system
npm install
```

### 2. Create a Supabase project

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql` and run it.
3. For local testing, you may turn off **Confirm email** under Authentication settings. Turn it back on before sharing the app publicly.

### 3. Add your settings

Copy the example file and fill in your own project's values (Project Settings, then API):

```bash
cp .env.local.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-key
```

Never commit `.env.local`, and never put a `service_role` or secret key in this app.

### 4. Run it

```bash
npm run dev
```

Open http://localhost:3000, sign up, then make your account an admin by running this in the Supabase SQL Editor (with your own email):

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

## Project structure

```
src/
  app/            pages (login, signup, dashboard, equipment, report, complaints)
  components/     shared components (navigation bar, forms, badges, stat cards)
  lib/            Supabase client and the useProfile helper
supabase/
  schema.sql      database tables, security rules and storage setup
```

## Screenshots

_To be added._

## Author

Hira Kanwal, Biomedical Engineering