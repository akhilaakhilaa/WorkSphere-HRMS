"""
Task Assignment & Tracking Router
WorkSphere HRMS - Module 24
"""

from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.employee import Employee
from app.models.notification import NotificationType
from app.models.task import Task, TaskStatus
from app.models.user import User, UserRole
from app.schemas.task import (
    TaskCreate,
    TaskResponse,
    TaskStatusUpdate,
    TaskSummary,
    TaskUpdate,
)
from app.utils.notifications import notify_user

router = APIRouter(prefix="/tasks", tags=["Module 24: Task Assignment & Tracking"])


def _to_task_response(t: Task) -> TaskResponse:
    """Helper to convert Task ORM to TaskResponse schema with overdue calculation."""
    today = date.today()
    is_overdue = t.status == TaskStatus.PENDING and t.due_date < today
    emp = t.assigned_employee
    return TaskResponse(
        id=t.id,
        assigned_to=t.assigned_to,
        assigned_employee_name=emp.full_name if emp else None,
        assigned_employee_code=f"EMP{emp.id:03d}" if emp else None,
        department=emp.department if emp else None,
        title=t.title,
        description=t.description,
        due_date=t.due_date,
        status=t.status,
        is_overdue=is_overdue,
        completed_at=t.completed_at,
        created_at=t.created_at,
        updated_at=t.updated_at,
    )


# --------------------------------------------------------------------------
# 1. Assign a Task (HR & Admin only)
# --------------------------------------------------------------------------
@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
def assign_task(
    task_in: TaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Assign a new task to an employee.
    Restricted to HR and ADMIN roles.
    """
    if current_user.role not in (UserRole.HR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only HR and Admin users can assign tasks.",
        )

    # 1. Verify assigned employee exists
    emp = db.query(Employee).filter(Employee.id == task_in.assigned_to).first()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee #{task_in.assigned_to} not found.",
        )

    clean_title = task_in.title.strip()
    if len(clean_title) < 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Task title must be at least 2 characters long.",
        )

    # 2. Create Task
    new_task = Task(
        assigned_to=task_in.assigned_to,
        title=clean_title,
        description=task_in.description.strip() if task_in.description else None,
        due_date=task_in.due_date,
        status=TaskStatus.PENDING,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # 3. Notify assigned employee
    if emp.user_id:
        try:
            notify_user(
                db=db,
                user_id=emp.user_id,
                title="New Task Assigned",
                message=f"You have been assigned task '{clean_title}' due on {task_in.due_date.strftime('%Y-%m-%d')}.",
                notif_type=NotificationType.SYSTEM,
                link="/tasks",
                related_entity_id=new_task.id,
            )
            db.commit()
        except Exception:
            pass

    return _to_task_response(new_task)


# --------------------------------------------------------------------------
# 2. Summary Metrics (Role-scoped for Employees, Org-wide for HR/Admin)
# --------------------------------------------------------------------------
@router.get("/summary", response_model=TaskSummary)
def get_tasks_summary(
    employee_id: Optional[int] = Query(None, description="Filter by employee ID (HR/Admin)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve task summary counts (total, pending, completed, overdue).
    - Employees receive stats for their own assigned tasks.
    - HR/Admin receive organization-wide stats or filtered by employee_id.
    """
    query = db.query(Task)
    today = date.today()

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            return TaskSummary(total_tasks=0, pending_tasks=0, completed_tasks=0, overdue_tasks=0)
        query = query.filter(Task.assigned_to == emp.id)
    elif employee_id:
        query = query.filter(Task.assigned_to == employee_id)

    records = query.all()
    total_tasks = len(records)
    pending_tasks = sum(1 for t in records if t.status == TaskStatus.PENDING)
    completed_tasks = sum(1 for t in records if t.status == TaskStatus.COMPLETED)
    overdue_tasks = sum(1 for t in records if t.status == TaskStatus.PENDING and t.due_date < today)

    return TaskSummary(
        total_tasks=total_tasks,
        pending_tasks=pending_tasks,
        completed_tasks=completed_tasks,
        overdue_tasks=overdue_tasks,
    )


# --------------------------------------------------------------------------
# 3. List Tasks (Scoped visibility)
# --------------------------------------------------------------------------
@router.get("", response_model=List[TaskResponse])
def list_tasks(
    assigned_to: Optional[int] = Query(None, description="Filter by assigned employee ID"),
    status_filter: Optional[TaskStatus] = Query(None, alias="status", description="Filter by status"),
    due_date: Optional[date] = Query(None, description="Filter by exact due date"),
    overdue_only: bool = Query(False, description="Filter only overdue pending tasks"),
    search: Optional[str] = Query(None, description="Search keyword in title or description"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List tasks with filtering and pagination.
    - Employees can only view their own assigned tasks.
    - HR/Admin can view all tasks across the organization.
    """
    query = db.query(Task)
    today = date.today()

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            return []

        # If employee explicitly tries to query another employee's tasks, reject with 403 Forbidden
        if assigned_to is not None and assigned_to != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Employees can only view their own assigned tasks.",
            )

        query = query.filter(Task.assigned_to == emp.id)
    else:
        # HR / Admin
        if assigned_to:
            query = query.filter(Task.assigned_to == assigned_to)

    if status_filter:
        query = query.filter(Task.status == status_filter)

    if due_date:
        query = query.filter(Task.due_date == due_date)

    if overdue_only:
        query = query.filter(Task.status == TaskStatus.PENDING, Task.due_date < today)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter((Task.title.ilike(term)) | (Task.description.ilike(term)))

    records = query.order_by(Task.due_date.asc(), Task.id.desc()).offset(skip).limit(limit).all()
    return [_to_task_response(t) for t in records]


# --------------------------------------------------------------------------
# 4. Get Task Details (Scoped)
# --------------------------------------------------------------------------
@router.get("/{task_id}", response_model=TaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve specific task details.
    - Employees can only view tasks assigned to themselves.
    - HR/Admin can view any task.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task #{task_id} not found.",
        )

    # Employee Access Isolation
    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or task.assigned_to != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot view tasks assigned to other employees.",
            )

    return _to_task_response(task)


# --------------------------------------------------------------------------
# 5. Update Task Status
# --------------------------------------------------------------------------
@router.patch("/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    status_in: TaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update status of a task (PENDING or COMPLETED).
    - Employees can update status for their own assigned tasks.
    - HR/Admin can update status for any task.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task #{task_id} not found.",
        )

    # Employee Access Isolation
    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or task.assigned_to != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: You cannot update status of tasks assigned to other employees.",
            )

    if status_in.status not in (TaskStatus.PENDING, TaskStatus.COMPLETED):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Status must be either PENDING or COMPLETED.",
        )

    task.status = status_in.status
    if status_in.status == TaskStatus.COMPLETED:
        task.completed_at = datetime.now()
    else:
        task.completed_at = None

    db.commit()
    db.refresh(task)
    return _to_task_response(task)


# --------------------------------------------------------------------------
# 6. Update Task Details (HR & Admin only)
# --------------------------------------------------------------------------
@router.put("/{task_id}", response_model=TaskResponse)
def update_task_details(
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update full task details (assignee, title, description, due date, status).
    Restricted to HR and ADMIN roles.
    """
    if current_user.role not in (UserRole.HR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only HR and Admin users can update task details.",
        )

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task #{task_id} not found.",
        )

    if task_in.assigned_to is not None:
        emp = db.query(Employee).filter(Employee.id == task_in.assigned_to).first()
        if not emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Employee #{task_in.assigned_to} not found.",
            )
        task.assigned_to = task_in.assigned_to

    if task_in.title is not None:
        clean_title = task_in.title.strip()
        if len(clean_title) < 2:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Task title must be at least 2 characters long.",
            )
        task.title = clean_title

    if task_in.description is not None:
        task.description = task_in.description.strip()

    if task_in.due_date is not None:
        task.due_date = task_in.due_date

    if task_in.status is not None:
        task.status = task_in.status
        if task_in.status == TaskStatus.COMPLETED:
            task.completed_at = datetime.now()
        else:
            task.completed_at = None

    db.commit()
    db.refresh(task)
    return _to_task_response(task)


# --------------------------------------------------------------------------
# 7. Delete Task (HR & Admin only)
# --------------------------------------------------------------------------
@router.delete("/{task_id}", status_code=status.HTTP_200_OK)
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a task.
    Restricted to HR and ADMIN roles.
    """
    if current_user.role not in (UserRole.HR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only HR and Admin users can delete tasks.",
        )

    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Task #{task_id} not found.",
        )

    db.delete(task)
    db.commit()
    return {"message": f"Task #{task_id} deleted successfully."}

