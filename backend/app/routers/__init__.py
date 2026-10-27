from app.routers.auth import router as auth_router
from app.routers.employees import router as employees_router
from app.routers.attendance import router as attendance_router
from app.routers.leaves import router as leaves_router
from app.routers.payroll import router as payroll_router
from app.routers.dashboard import router as dashboard_router
from app.routers.notifications import router as notifications_router
from app.routers.users import router as users_router
from app.routers.shifts import router as shifts_router
from app.routers.documents import router as documents_router
from app.routers.performance import router as performance_router
from app.routers.advanced_analytics import router as advanced_analytics_router

__all__ = [
    "auth_router",
    "employees_router",
    "attendance_router",
    "leaves_router",
    "payroll_router",
    "dashboard_router",
    "notifications_router",
    "users_router",
    "shifts_router",
    "documents_router",
    "performance_router",
    "advanced_analytics_router",
]
