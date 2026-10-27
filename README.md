WorkSphere – Human Resource Management System (HRMS)
WorkSphere is a full-stack, web-based Human Resource Management System designed to simplify and streamline organizational HR operations. It provides a centralized platform for employee management, attendance tracking, leave management, payroll processing, analytics, notifications, and administrative user controls.

The application uses React and Vite for the frontend, FastAPI for the backend, and MySQL for database management.
Features
Phase 1 – Core HR Management System
1. Authentication and Role-Based Access
- Secure login using JWT authentication.
- Role-based access for Employees, HR, and Administrators.
- Protected routes and authorization checks.
- Password hashing for secure credential storage.
2. Employee Management
- Create, view, update, and manage employee records.
- View employee profiles and details.
- Search and filter employee information.
- Maintain employee status and organizational information.
3. Attendance Management
- Employee check-in and check-out.
- Track working hours and attendance status.
- View attendance history.
- Access organization-wide attendance information according to user roles.
4. Leave Management
- Submit leave applications.
- View leave history and application status.
- Approve or reject leave requests based on user roles.
- Track employee leave information.
5. Payroll Management
- Manage payroll records.
- Generate payroll information.
- View salary details and payslips.
- Maintain employee payroll history.
6. Dashboard and Analytics
- Role-based dashboards.
- Display key HR metrics and summaries.
- Visualize organizational information through charts and analytics.
7. Notifications and Announcements
- View notifications and unread notification counts.
- Mark individual notifications as read.
- Mark all notifications as read.
- Send organization-wide announcements through administrator functionality.
Phase 2 – Advanced HRMS Features
8. Advanced Attendance and Automated Scheduler — Module 10
- Calculate overtime based on working hours.
- Classify attendance using working-hour thresholds.
- Generate attendance summary metrics, including overtime hours.
- Automatically identify employees who have not recorded attendance.
- Schedule automated absent marking on weekdays.
- Protect existing attendance records from being overwritten.
- Exclude employees with approved leave.
- Prevent absent marking on weekends and configured public holidays.
- Reject requests involving future dates.
- Support dry-run execution to preview absent-marking changes.
- Provide HR/Admin controls for on-demand absent marking.
- Display overtime information in the attendance dashboard.
9. Leave Policies and Balances — Module 11
- Define annual leave allowances for different leave categories.
- Track allowed, used, and remaining leave days.
- Display leave balances using dashboard cards and progress bars.
- Allow authorized HR/Admin users to manage leave policies.
- Deduct leave balances when requests are approved.
- Prevent approvals when the employee has insufficient leave balance.
- Restore deducted balances when an approved request is cancelled or changed to rejected.
- Prevent pending and rejected requests from incorrectly deducting leave.
- Protect against repeated approvals and duplicate deductions.
- Display leave balance information during application and review.
10. Payroll Enhancements — Module 12
- Calculate detailed employee salary components.
- Support basic salary, HRA, transport allowance, medical allowance, other allowances, and performance bonuses.
- Calculate gross salary and total deductions.
- Support tax deductions, provident fund, and other deductions.
- Calculate net take-home salary.
- Validate monetary values and prevent invalid salary calculations.
- Preserve historical payroll figures when an employee's base salary changes.
- Generate organization-level monthly payroll summaries.
- Track payroll period status, including paid, pending, partially paid, and periods without records.
- Provide HR/Admin payroll management and salary adjustment controls.
- Restrict employees to their own payslips and salary breakdowns.
- Display detailed salary breakdowns.
- Provide printable payslips.
11. Admin Controls and User Management — Module 13
- Create, view, search, update, and manage user accounts.
- Search users by username, email, or employee name.
- Filter users by role and account status.
- Assign roles: EMPLOYEE, HR, and ADMIN.
- Activate and deactivate user accounts.
- Prevent deactivated users from accessing protected API endpoints.
- Protect user management operations with administrator-only authorization.
- Prevent unauthorized role escalation.
- Protect the last active administrator from accidental removal or deactivation.
- Preserve historical attendance, leave, and payroll records.
- Prevent deletion of accounts associated with business records.
- Provide an administrator dashboard for user management.
- Support account creation, editing, status changes, and account detail inspection.
12. Shift Management — Module 14
- Define shifts and assign them to employees.
- Track late arrivals and early departures based on shift schedules.
13. Leave Calendar and Team View — Module 15
- View team leave schedules in a calendar.
- Review team availability and identify potential leave conflicts.
14. Document Management — Module 16
- Upload and organize categorized employee documents.
- Preview and download documents with access controls.
15. Performance Reviews — Module 17
- Manage review periods, ratings, feedback, and employee goals.
16. Advanced Analytics and Reports — Module 18
- Review attendance and leave trends, performance insights, and department comparisons.
- Export supported reports to CSV.
17. Smart Notifications — Module 19
- Receive alerts for late attendance, leave decisions, and successful payroll processing.
18. Advanced Employee Search — Module 20
- Search and filter employees by name, department, role, status, attendance, and performance.
- Sort results and navigate paginated employee lists.
Technology Stack
Frontend
- React
- Vite
- JavaScript
- HTML
- CSS
Backend
- Python
- FastAPI
- SQLAlchemy
- Pydantic
- JWT authentication
- APScheduler for scheduled attendance processing
Database
- MySQL
Development Tools
- Visual Studio Code
- MySQL Server and MySQL Workbench
- Git and GitHub
- Node.js and npm
- Python virtual environment
Project Structure
The project is organized into frontend and backend components.
WorkSphere/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── routers/
│   │   └── ...
│   ├── requirements.txt
│   └── test_*.py
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── ...
├── screenshots/
│   ├── Batch1/
│   ├── Batch2/
│   └── Batch3/
├── .gitignore
└── README.md

Note: This is an illustrative structure. Actual folders and filenames may vary depending on the implementation.
Prerequisites
Install the following before running the application:
- Python 3.10 or later
- Node.js and npm
- MySQL Server
- Git
Installation and Setup
1. Clone the Repository
Replace the placeholder with your actual GitHub repository URL.
git clone <your-repository-url>
cd WorkSphere
2. Configure MySQL
Create the database:
CREATE DATABASE worksphere_db;
Configure the required environment variables in backend/.env using your local database credentials and application settings.

Important: Do not upload .env files, database passwords, JWT secrets, Stripe keys, or other sensitive credentials to GitHub.
3. Set Up the Backend
Open a terminal in the project root.
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Start the FastAPI development server:
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
Backend URL:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs
4. Set Up the Frontend
Open a second terminal in the project root.
cd frontend
npm install
npm run dev
Open the local frontend URL displayed in the terminal. Vite commonly uses:

http://localhost:5173

Ensure the frontend API configuration points to the running backend.
Testing
The project includes automated test suites for the implemented modules.

Reported test files include:
Test File	Coverage
backend/test_batch1.py	Authentication, employee management, and basic attendance
backend/test_batch2.py	Leave management, payroll, dashboard, and analytics
backend/test_batch3.py	Notifications and announcements
backend/test_module10.py	Advanced attendance, overtime, automated absent marking, and safeguards
backend/test_module11.py	Leave policies, balances, approval deductions, and balance validation
backend/test_module12.py	Salary breakdown, monthly payroll summaries, validation, and payroll authorization
backend/test_module13.py	User management, role assignment, account status, authorization, and safeguards


Run the appropriate test file using the backend virtual environment. For example:
cd backend
.\venv\Scripts\python.exe test_module13.py
Use the actual test files available in the repository. Run the relevant test suites before considering a release complete.
Screenshots
Screenshots demonstrating the application's features and functionality are attached with the project for reference.
