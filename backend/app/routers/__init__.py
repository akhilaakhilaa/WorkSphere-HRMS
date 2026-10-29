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
from app.routers.onboarding import router as onboarding_router
from app.routers.resignation import router as resignation_router
from app.routers.announcements import router as announcements_router
from app.routers.tasks import router as tasks_router
from app.routers.integrations import router as integrations_router
from app.routers.feedback import router as feedback_router
from app.routers.profile import router as profile_router

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
    "onboarding_router",
    "resignation_router",
    "announcements_router",
    "tasks_router",
    "integrations_router",
    "feedback_router",
    "profile_router",
]
