
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from apscheduler.schedulers.background import BackgroundScheduler

from app.attendance_tasks import (
    is_public_holiday,
    is_weekend,
    mark_absent_employees,
)
from app.config import AUTO_ABSENT_DRY_RUN
from app.database import Base, engine
from app.routers import (
    attendance_router,
    auth_router,
    dashboard_router,
    employees_router,
    leaves_router,
    notifications_router,
    payroll_router,
    shifts_router,
    users_router,
    documents_router,
    performance_router,
    advanced_analytics_router,
)


# Initialize database tables
Base.metadata.create_all(bind=engine)


# Initialize the attendance scheduler
scheduler = BackgroundScheduler()


def run_absent_marking():
    """
    Mark employees absent for the completed workday at 6:00 PM.
    - Uses today's date since standard shifts complete at 6:00 PM.
    - Automatically skips weekends and configured public holidays.
    - Prevents duplicates and avoids marking employees with approved leave or existing attendance.
    """
    from datetime import date

    today = date.today()

    if is_weekend(today):
        print(f"[Attendance Scheduler] {today} is a weekend. Skipping absent marking.")
        return

    if is_public_holiday(today):
        print(f"[Attendance Scheduler] {today} is a configured public holiday. Skipping absent marking.")
        return

    work_date = today

    count = mark_absent_employees(
        work_date=work_date,
        dry_run=AUTO_ABSENT_DRY_RUN,
    )

    mode = "DRY RUN" if AUTO_ABSENT_DRY_RUN else "COMMITTED"
    print(
        f"[Attendance Scheduler] {work_date}: "
        f"{count} employees marked absent ({mode})."
    )


# Schedule the job for 6:00 PM, Monday through Friday.
# coalesce=True & max_instances=1 prevent multiple unintended executions.
scheduler.add_job(
    run_absent_marking,
    trigger="cron",
    day_of_week="mon-fri",
    hour=18,
    minute=0,
    id="automatic_absent_marking",
    replace_existing=True,
    coalesce=True,
    max_instances=1,
    misfire_grace_time=3600,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not scheduler.running:
        scheduler.start()

    try:
        yield
    finally:
        if scheduler.running:
            scheduler.shutdown(wait=False)



app = FastAPI(
    title="WorkSphere HRMS API",
    description="Human Resource Management System API",
    version="3.0.0",
    lifespan=lifespan,
)


# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers
app.include_router(auth_router, prefix="/api")
app.include_router(employees_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(leaves_router, prefix="/api")
app.include_router(payroll_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(shifts_router, prefix="/api")
app.include_router(documents_router, prefix="/api")
app.include_router(performance_router, prefix="/api")
app.include_router(advanced_analytics_router, prefix="/api")


@app.get("/")
def home():
    return {
        "message": "Welcome to WorkSphere HRMS API",
        "status": "running",
        "version": "3.0.0",
        "modules": [
            "Module 1: Authentication & Roles",
            "Module 2: Employee Management",
            "Module 3: Attendance Management",
            "Module 4: Leave Management",
            "Module 5: Payroll Management",
            "Module 6: Dashboard & Analytics",
            "Module 7: Notifications",
            "Module 10: Advanced Attendance",
        ],
    }


@app.get("/db-check")
def check_database():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))

        return {
            "message": "MySQL connection successful",
            "database": "worksphere_db",
            "status": "connected",
        }

    except SQLAlchemyError as err:
        raise HTTPException(
            status_code=500,
            detail=f"Database connection failed: {str(err)}",
        )
