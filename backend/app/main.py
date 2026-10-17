from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import Base, engine
from app.routers import (
    attendance_router,
    auth_router,
    dashboard_router,
    employees_router,
    leaves_router,
    notifications_router,
    payroll_router,
)

# Initialize database tables (creates newly added tables without altering existing data)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="WorkSphere HRMS API",
    description="Human Resource Management System API - Modules 1 through 7",
    version="3.0.0",
)

# Enable CORS for frontend applications
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_router, prefix="/api")
app.include_router(employees_router, prefix="/api")
app.include_router(attendance_router, prefix="/api")
app.include_router(leaves_router, prefix="/api")
app.include_router(payroll_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(notifications_router, prefix="/api")


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
