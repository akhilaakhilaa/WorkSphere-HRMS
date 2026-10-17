# WorkSphere – Human Resource Management System (HRMS)

WorkSphere is a web-based Human Resource Management System designed to simplify and streamline organizational HR operations. It provides a centralized platform for managing employees, tracking attendance, processing leave requests, handling payroll, monitoring analytics, and delivering notifications.

## Features

### 1. Authentication & Role-Based Access
- Secure login using JWT authentication.
- Role-based access for Employees, HR, and Administrators.
- Protected routes and access control.

### 2. Employee Management
- Create, view, update, and manage employee records.
- View employee profiles and details.
- Search and filter employee information.

### 3. Attendance Management
- Employee check-in and check-out.
- Track attendance records and status.
- View attendance history and organization-wide attendance information.

### 4. Leave Management
- Submit leave applications.
- View leave history and application status.
- Approve or reject leave requests based on user roles.

### 5. Payroll Management
- Manage payroll records.
- Generate payroll information.
- View salary details and payslips.

### 6. Dashboard & Analytics
- Role-based dashboards.
- Display key HR metrics and summaries.
- Visualize organizational data through charts and analytics.

### 7. Notifications
- View notifications and unread notification counts.
- Mark individual notifications as read.
- Mark all notifications as read.
- Send organization-wide announcements through administrator functionality.

## Technology Stack

**Frontend**
- React
- Vite
- JavaScript
- HTML and CSS

**Backend**
- Python
- FastAPI
- SQLAlchemy
- Pydantic
- JWT authentication

**Database**
- MySQL

## Project Structure

```text
WorkSphere/
├── backend/
│   ├── app/
│   ├── .env
│   └── venv/
├── frontend/
│   ├── src/
│   ├── public/
│   └── package.json
├── screenshots/
│   ├── Batch1/
│   ├── Batch2/
│   └── Batch3/
├── .gitignore
└── README.md
```

*The structure above is illustrative; actual files and folders may vary.*

## Prerequisites

- Python 3.10 or later
- Node.js and npm
- MySQL Server
- Git

## Installation and Setup

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd WorkSphere
```

### 2. Configure the Database

Create a MySQL database named `worksphere_db`.

```sql
CREATE DATABASE worksphere_db;
```

Configure the database connection and required environment variables in `backend/.env`. Use your local database credentials and a secure JWT secret.

**Important:** Never commit `.env` files or passwords to version control.

### 3. Set Up the Backend

Open a terminal in the project root and run:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Start the FastAPI server:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend API: http://127.0.0.1:8000

API documentation: http://127.0.0.1:8000/docs

### 4. Set Up the Frontend

Open a second terminal in the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the frontend URL displayed in the terminal. The default Vite development URL is usually:

http://127.0.0.1:5173

Ensure the frontend API configuration points to the running backend.

## Testing

Run the project's available automated tests and verify the following functionality:

- Authentication and role-based authorization.
- Employee creation, updates, search, and retrieval.
- Attendance check-in, check-out, and history.
- Leave application and approval workflows.
- Payroll generation and payslip details.
- Dashboard metrics and analytics.
- Notification retrieval and read-status updates.

Use the test commands and files available in the repository.

## Screenshots

Screenshots demonstrating the application can be organized into the following folders:

- `screenshots/Batch1/` – Authentication, employee management, and attendance.
- `screenshots/Batch2/` – Leave management, payroll, and analytics.
- `screenshots/Batch3/` – Notifications and announcements.

## Security Considerations

- Store database credentials and secrets in environment variables.
- Keep environment files out of version control.
- Enforce authentication and role-based authorization on protected endpoints.
- Validate user input and handle errors appropriately.
- Use HTTPS and secure production settings when deploying.

## Future Enhancements

- Email and push notification integration.
- Payroll reports and downloadable payslips.
- Advanced analytics and reporting.
- Improved audit logging.
- Production deployment and monitoring.

## License

This project is intended for educational and demonstration purposes unless otherwise specified.
