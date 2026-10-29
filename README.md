WorkSphere – Human Resource Management System (HRMS)

WorkSphere is a full-stack web application designed to streamline common human-resource operations through a centralized platform. It brings together employee records, attendance, leave management, payroll, analytics, notifications, onboarding, task tracking, feedback, and profile settings.

Repository: https://github.com/akhilaakhilaa/WorkSphere-HRMS

Project status: This README describes the features documented for WorkSphere Modules 1–27. Verify the current source code, database migrations, screenshots, and test results in the repository before presenting any feature or test as independently verified.

Table of Contents

- Features by Phase

- Technology Stack

- Project Structure

- Prerequisites

- Installation and Setup

- Environment Configuration

- Running the Application

- Testing

- Screenshots

- Security Notes

- Future Improvements

Features by Phase

Phase 1 – Core HR Management System

Core modules

- Authentication and role-based access: JWT-based login, protected routes, authorization checks, and password hashing for Employee, HR, and Admin roles.

- Employee management: Create, view, update, search, and filter employee records; maintain employee status and organizational details.

- Attendance management: Check-in/check-out, working-hour tracking, attendance status, and attendance history.

- Leave management: Submit leave requests, view request history and status, and approve or reject requests according to role permissions.

- Payroll management: Maintain payroll records, salary details, payslips, and payroll history.

- Dashboard and analytics: Role-based dashboards, key HR metrics, summaries, charts, and organizational insights.

- Notifications and announcements: View notifications, track unread counts, mark notifications as read, and receive announcement alerts.

Phase 2 – Advanced HRMS Features

Note: The feature list below documents the modules currently described in this README. Modules 8 and 9 are not listed here; add them if they are part of the project's original requirements.

- Module 10 – Advanced attendance and automated scheduler: Overtime calculations, working-hour classifications, scheduled absent marking, dry-run previews, and safeguards for existing attendance, approved leave, weekends, holidays, and future dates.

- Module 11 – Leave policies and balances: Configure leave allowances, track allowed/used/remaining balances, validate available balances, and handle deductions/restorations for leave decisions.

- Module 12 – Payroll enhancements: Salary components, allowances, bonuses, deductions, gross/net pay, monthly payroll summaries, payroll status tracking, salary adjustments, and printable payslips. Employee access is intended to be restricted to their own salary information.

- Module 13 – Admin controls and user management: Create, search, update, activate, and deactivate accounts; assign roles; enforce administrator-only controls; and guard against unauthorized privilege escalation.

- Module 14 – Shift management: Define and assign shifts, and track late arrivals or early departures against schedules.

- Module 15 – Leave calendar and team view: View team leave schedules and availability in a calendar.

- Module 16 – Document management: Upload, organize, preview, and download employee documents with access controls.

- Module 17 – Performance reviews: Manage review periods, ratings, feedback, and employee goals.

- Module 18 – Advanced analytics and reports: Review attendance and leave trends, performance insights, department comparisons, and supported CSV reports.

- Module 19 – Smart notifications: Receive alerts for events such as late attendance, leave decisions, and payroll processing.

- Module 20 – Advanced employee search: Search and filter by employee name, department, role, status, attendance, and performance; sort and paginate results.

Phase 3 – Employee Lifecycle and Team Operations

- Module 21 – Employee onboarding: Assign and track onboarding checklists and completion progress; provide HR/Admin overview, presets, department filters, and overdue tracking.

- Module 22 – Resignation and exit management: Submit resignation requests and track status; prevent duplicate active requests, invalid transitions, and self-approval; provide an HR/Admin review dashboard.

- Module 23 – Internal announcements: Publish, edit, and manage announcements with creator attribution; display newest-first announcements and details; restrict management actions to HR/Admin.

- Module 24 – Task assignment and tracking: Assign tasks with descriptions and due dates; track pending/completed status and overdue tasks; provide HR/Admin filters and summaries while limiting employee access to their own assignments.

Phase 4 – Integrations, Feedback, and Personal Settings

- Module 25 – Third-party integrations and reports: Export supported datasets to CSV/PDF, mitigate CSV formula injection, generate iCalendar (.ics) feeds/files, and provide a configurable SMTP email utility and integration status endpoint. An iCalendar feed is not the same as a full Google Calendar OAuth synchronization.

- Module 26 – Employee feedback: Submit comments with a 1–5 star rating; notify HR/Admin according to the implementation; provide a dashboard with submission count, average score, and rating distribution; restrict employees to their own submissions.

- Module 27 – Profile and settings: View/update permitted profile information, change passwords with current-password verification and confirmation, and manage supported notification preferences. Privileged fields such as role and salary should not be editable through ordinary profile updates.

Technology Stack

Layer   Technologies

Frontend    React, Vite, JavaScript, HTML, CSS

Backend Python, FastAPI, SQLAlchemy, Pydantic

Authentication  JWT authentication and role-based authorization

Database    MySQL

Scheduling  APScheduler for scheduled attendance processing

Reporting and exports   CSV, ReportLab PDF, iCalendar (.ics)

Development tools   Visual Studio Code, MySQL Server, MySQL Workbench, Git, GitHub, Node.js, npm, Python virtual environment

Project Structure

Illustrative structure only; filenames and folders may differ in the actual repository.

WorkSphere-HRMS/

├── backend/

│   ├── app/

│   │   ├── main.py

│   │   ├── models/

│   │   ├── routers/

│   │   └── ...

│   ├── requirements.txt

│   └── test_*.py

├── frontend/

│   ├── src/

│   ├── public/

│   ├── package.json

│   └── ...

├── screenshots/

│   ├── Phase1/       # Optional: organize screenshots by phase

│   ├── Phase2/

│   ├── Phase3/

│   └── Phase4/

├── .gitignore

└── README.md

Prerequisites

Install the following before running the application:

- Python 3.10 or later

- Node.js and npm

- MySQL Server

- Git

Installation and Setup

1. Clone the repository

git clone https://github.com/akhilaakhilaa/WorkSphere-HRMS.git

cd WorkSphere-HRMS

If the checked-out folder has a different name, change into that folder instead.

2. Create the database

In MySQL, create the database if it does not already exist:

CREATE DATABASE worksphere_db;

Configure the database connection using the environment variables expected by the backend. Creating the database does not necessarily create all application tables; follow the actual migration or table-initialization instructions in the repository.

Environment Configuration

Create a local backend/.env file with the environment variables required by the project. Use the actual names expected by the code. Typical settings may include:

- Database connection URL or individual database connection fields

- JWT/application secret

- SMTP configuration, if email delivery is enabled

For Module 25, the documented SMTP settings are:

Variable    Purpose

SMTP_HOST   SMTP server hostname

SMTP_PORT   SMTP server port

SMTP_USER   SMTP username

SMTP_PASSWORD   SMTP password

SMTP_FROM   Sender email address

SMTP_TLS    TLS configuration

EMAIL_DEV_MODE  Simulated email delivery in development, if supported by the application

Use development mode for local testing when configured. Simulated delivery does not prove that a real email was sent. Optional integrations should only be configured if the implementation supports them.

Never commit .env files, database passwords, JWT secrets, SMTP passwords, API keys, or other credentials to GitHub. Do not place secrets in frontend code or screenshots.

Running the Application

Backend

Open a terminal in the repository root:

cd backend

python -m venv venv

.\venv\Scripts\Activate.ps1

pip install -r requirements.txt

Apply the database initialization/migration steps documented by the actual repository, then start FastAPI:

uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

- Backend: http://127.0.0.1:8000

- Interactive API documentation: http://127.0.0.1:8000/docs

Frontend

Open a second terminal in the repository root:

cd frontend

npm install

npm run dev

Open the local URL printed by Vite (commonly http://localhost:5173). Make sure the frontend API configuration points to the running backend.

Testing

Automated test files are useful for verifying behavior, permissions, validation, and data isolation. The table below reflects test files previously documented for this project; confirm each file exists and run it before claiming that its tests pass.

Test file   Intended coverage described in the project

test_batch1.py  Authentication, employee management, basic attendance

test_batch2.py  Leave management, payroll, dashboard, analytics

test_batch3.py  Notifications and announcements

test_module10.py    Advanced attendance, overtime, absent-marking safeguards

test_module11.py    Leave policies, balances, approval deductions, validation

test_module12.py    Salary breakdown, payroll summaries, validation, authorization

test_module13.py    User management, roles, account status, authorization

test_module14.py    Shift management, grace periods, late-arrival tracking

test_module15.py    Leave calendar, team views, scheduling, overlap prevention

test_module16.py    Document management, file validation, access isolation

test_module17.py    Performance management, rating validation, review periods

test_module18.py    Analytics, department trends, CSV reports

test_module19.py    Smart notifications, event alerts, unread badge synchronization

test_module20.py    Employee search, filters, sorting, pagination

test_module21.py    Onboarding checklists, progress tracking, HR task administration

test_module22.py    Resignation workflow, self-approval prevention, status guards

test_module23.py    Announcements, creator attribution, notifications, permissions

test_module24.py    Task assignment, employee isolation, status updates, summaries

test_module25.py    Integrations, SMTP status, calendar export, CSV/PDF exports, RBAC

test_module26.py    Feedback submission, rating validation, privacy, HR/Admin metrics

test_module27.py    Profile access, privilege protection, password verification, preferences

Run only the test commands supported by the actual project. For example, from the backend directory, a project using directly executable test files may support:

.\venv\Scripts\python.exe test_module27.py

If the project uses pytest, use the test command and configuration specified by the repository. Run relevant backend tests and check the frontend production build:

cd frontend

npm run build

Record actual results rather than assuming a test passed because a test file exists.

Screenshots

Screenshots are stored in the screenshots/ directory.
Security Notes
- Do not commit sensitive credentials or .env files to the repository.
- Verify backend authentication, role-based authorization, and record-ownership checks.
- Restrict access to sensitive employee and payroll data.
- Store SMTP credentials securely and configure them only when needed.
Future Enhancements
- Integrate additional third-party services.
- Expand automated testing and accessibility checks.
- Add deployment automation and application monitoring.