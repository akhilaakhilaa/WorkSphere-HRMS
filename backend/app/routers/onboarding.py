from datetime import date, datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee
from app.models.notification import NotificationType
from app.models.onboarding import OnboardingTask, OnboardingTaskStatus
from app.models.user import User, UserRole
from app.schemas.onboarding import (
    OnboardingProgressResponse,
    OnboardingSummaryResponse,
    OnboardingTaskCreate,
    OnboardingTaskResponse,
    OnboardingTaskStatusUpdate,
    OnboardingTaskUpdate,
)
from app.utils.notifications import notify_user

router = APIRouter(prefix="/onboarding", tags=["Module 21: Employee Onboarding System"])


def _to_task_response(task: OnboardingTask) -> OnboardingTaskResponse:
    today = date.today()
    is_overdue = task.status == OnboardingTaskStatus.PENDING and task.due_date < today
    return OnboardingTaskResponse(
        id=task.id,
        employee_id=task.employee_id,
        employee_name=task.employee.full_name if task.employee else None,
        department=task.employee.department if task.employee else None,
        task_name=task.task_name,
        status=task.status,
        due_date=task.due_date,
        is_overdue=is_overdue,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _calculate_employee_progress(emp: Employee, tasks: List[OnboardingTask]) -> OnboardingProgressResponse:
    today = date.today()
    total_tasks = len(tasks)
    completed_tasks = sum(1 for t in tasks if t.status == OnboardingTaskStatus.COMPLETED)
    pending_tasks = total_tasks - completed_tasks
    overdue_tasks = sum(1 for t in tasks if t.status == OnboardingTaskStatus.PENDING and t.due_date < today)
    progress_percentage = round((completed_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0.0
    is_completed = total_tasks > 0 and completed_tasks == total_tasks

    task_responses = [_to_task_response(t) for t in sorted(tasks, key=lambda x: (x.status == OnboardingTaskStatus.COMPLETED, x.due_date, x.id))]

    return OnboardingProgressResponse(
        employee_id=emp.id,
        employee_name=emp.full_name,
        department=emp.department,
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        pending_tasks=pending_tasks,
        overdue_tasks=overdue_tasks,
        progress_percentage=progress_percentage,
        is_completed=is_completed,
        tasks=task_responses,
    )


@router.post("", response_model=OnboardingTaskResponse, status_code=http_status.HTTP_201_CREATED)
def create_onboarding_task(
    task_in: OnboardingTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Create and assign a new onboarding task to an employee.
    Restricted to ADMIN and HR roles.
    """
    # 1. Validate employee exists
    emp = db.query(Employee).filter(Employee.id == task_in.employee_id).first()
    if not emp:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {task_in.employee_id} not found",
        )

    # 2. Validate task name
    clean_task_name = task_in.task_name.strip()
    if not clean_task_name:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Task name cannot be empty",
        )

    # 3. Create task record
    new_task = OnboardingTask(
        employee_id=task_in.employee_id,
        task_name=clean_task_name,
        status=task_in.status or OnboardingTaskStatus.PENDING,
        due_date=task_in.due_date,
        completed_at=datetime.now() if task_in.status == OnboardingTaskStatus.COMPLETED else None,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    # 4. Notify employee if linked user account exists
    if emp.user_id:
        try:
            notify_user(
                db=db,
                user_id=emp.user_id,
                title="New Onboarding Task Assigned",
                message=f"You have been assigned an onboarding task: '{new_task.task_name}' due on {new_task.due_date.strftime('%Y-%m-%d')}.",
                notif_type=NotificationType.SYSTEM,
                link="/onboarding",
            )
            db.commit()
        except Exception:
            pass

    return _to_task_response(new_task)


@router.get("", response_model=List[OnboardingTaskResponse])
def list_onboarding_tasks(
    employee_id: Optional[int] = Query(None, description="Filter by employee ID (HR/Admin only)"),
    status: Optional[OnboardingTaskStatus] = Query(None, description="Filter by status (PENDING/COMPLETED)"),
    overdue_only: bool = Query(False, description="Filter only overdue pending tasks"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve onboarding tasks with optional filtering.
    - HR/Admin: Can retrieve all tasks across employees or filter by specific employee.
    - Employee: Can only view their own assigned onboarding tasks.
    """
    query = db.query(OnboardingTask)

    if current_user.role not in [UserRole.ADMIN, UserRole.HR]:
        # Regular employee: Find linked employee record
        current_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not current_emp:
            return []

        # If user explicitly probes another employee's tasks, block with 403
        if employee_id is not None and employee_id != current_emp.id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own onboarding tasks",
            )
        query = query.filter(OnboardingTask.employee_id == current_emp.id)
    else:
        # HR/Admin
        if employee_id is not None:
            query = query.filter(OnboardingTask.employee_id == employee_id)

    if status:
        query = query.filter(OnboardingTask.status == status)

    if overdue_only:
        query = query.filter(
            OnboardingTask.status == OnboardingTaskStatus.PENDING,
            OnboardingTask.due_date < date.today(),
        )

    tasks = query.order_by(OnboardingTask.due_date.asc(), OnboardingTask.id.asc()).all()
    return [_to_task_response(t) for t in tasks]


@router.get("/summary", response_model=OnboardingSummaryResponse)
def get_onboarding_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Get organization-level onboarding summary statistics.
    Restricted to ADMIN and HR.
    """
    today = date.today()
    tasks = db.query(OnboardingTask).all()

    total_assigned = len(tasks)
    total_completed = sum(1 for t in tasks if t.status == OnboardingTaskStatus.COMPLETED)
    total_pending = total_assigned - total_completed
    total_overdue = sum(1 for t in tasks if t.status == OnboardingTaskStatus.PENDING and t.due_date < today)
    completion_rate = round((total_completed / total_assigned * 100), 1) if total_assigned > 0 else 0.0

    # Group by employee to check onboarding progress
    emp_tasks = {}
    for t in tasks:
        emp_tasks.setdefault(t.employee_id, []).append(t)

    employees_onboarding_count = len(emp_tasks)
    fully_onboarded_count = sum(
        1 for t_list in emp_tasks.values() if all(t.status == OnboardingTaskStatus.COMPLETED for t in t_list)
    )

    return OnboardingSummaryResponse(
        total_assigned_tasks=total_assigned,
        total_completed_tasks=total_completed,
        total_pending_tasks=total_pending,
        total_overdue_tasks=total_overdue,
        overall_completion_rate=completion_rate,
        employees_onboarding_count=employees_onboarding_count,
        fully_onboarded_employees_count=fully_onboarded_count,
    )


@router.get("/progress", response_model=OnboardingProgressResponse)
def get_my_onboarding_progress(
    employee_id: Optional[int] = Query(None, description="Employee ID for HR/Admin queries"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get onboarding progress and checklist for current employee (or specified employee for HR/Admin).
    """
    target_emp_id = None

    if current_user.role not in [UserRole.ADMIN, UserRole.HR]:
        current_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not current_emp:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail="No employee profile associated with this user account",
            )
        if employee_id is not None and employee_id != current_emp.id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own onboarding progress",
            )
        target_emp_id = current_emp.id
        emp = current_emp
    else:
        # HR/Admin
        if employee_id is not None:
            target_emp_id = employee_id
            emp = db.query(Employee).filter(Employee.id == target_emp_id).first()
            if not emp:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=f"Employee with ID {target_emp_id} not found",
                )
        else:
            # If no ID specified, look up own employee record if present, else first employee
            current_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
            if current_emp:
                target_emp_id = current_emp.id
                emp = current_emp
            else:
                emp = db.query(Employee).first()
                if not emp:
                    raise HTTPException(
                        status_code=http_status.HTTP_404_NOT_FOUND,
                        detail="No employees found in the system",
                    )
                target_emp_id = emp.id

    tasks = db.query(OnboardingTask).filter(OnboardingTask.employee_id == target_emp_id).all()
    return _calculate_employee_progress(emp, tasks)


@router.get("/progress/all", response_model=List[OnboardingProgressResponse])
def get_all_onboarding_progress(
    department: Optional[str] = Query(None, description="Filter by department"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Get onboarding progress across all employees.
    Restricted to ADMIN and HR roles.
    """
    emp_query = db.query(Employee)
    if department and department.strip() and department.strip().lower() != "all departments":
        emp_query = emp_query.filter(Employee.department == department.strip())

    employees = emp_query.order_by(Employee.id.asc()).all()

    # Fetch all tasks in one query
    all_tasks = db.query(OnboardingTask).all()
    tasks_by_emp = {}
    for t in all_tasks:
        tasks_by_emp.setdefault(t.employee_id, []).append(t)

    results = []
    for emp in employees:
        emp_tasks = tasks_by_emp.get(emp.id, [])
        # Include employee if they have tasks or if list is requested
        results.append(_calculate_employee_progress(emp, emp_tasks))

    return results


@router.get("/progress/{employee_id}", response_model=OnboardingProgressResponse)
def get_employee_onboarding_progress(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve onboarding progress calculation for a specific employee.
    Enforces cross-employee authorization: Employees can only view their own progress.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found",
        )

    if current_user.role not in [UserRole.ADMIN, UserRole.HR]:
        if emp.user_id != current_user.id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own onboarding progress",
            )

    tasks = db.query(OnboardingTask).filter(OnboardingTask.employee_id == employee_id).all()
    return _calculate_employee_progress(emp, tasks)


@router.get("/employee/{employee_id}", response_model=List[OnboardingTaskResponse])
def get_tasks_for_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve onboarding tasks specifically for a given employee.
    - HR/Admin: Can view tasks for any employee.
    - Employee: Can only view tasks if employee_id matches their own.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found",
        )

    if current_user.role not in [UserRole.ADMIN, UserRole.HR]:
        if emp.user_id != current_user.id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only access your own onboarding tasks",
            )

    tasks = (
        db.query(OnboardingTask)
        .filter(OnboardingTask.employee_id == employee_id)
        .order_by(OnboardingTask.due_date.asc(), OnboardingTask.id.asc())
        .all()
    )
    return [_to_task_response(t) for t in tasks]


@router.patch("/{task_id}/status", response_model=OnboardingTaskResponse)
@router.put("/{task_id}/status", response_model=OnboardingTaskResponse)
def update_onboarding_task_status(
    task_id: int,
    status_in: OnboardingTaskStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update onboarding task status (e.g. mark as COMPLETED or PENDING).
    - Employees can update the status of their own assigned tasks.
    - HR and Admin can update the status of any task.
    """
    task = db.query(OnboardingTask).filter(OnboardingTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Onboarding task #{task_id} not found",
        )

    # Check permission
    if current_user.role not in [UserRole.ADMIN, UserRole.HR]:
        if not task.employee or task.employee.user_id != current_user.id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only update your own onboarding tasks",
            )

    task.status = status_in.status
    if status_in.status == OnboardingTaskStatus.COMPLETED:
        task.completed_at = datetime.now()
    else:
        task.completed_at = None

    db.commit()
    db.refresh(task)
    return _to_task_response(task)


@router.put("/{task_id}", response_model=OnboardingTaskResponse)
def update_onboarding_task(
    task_id: int,
    task_in: OnboardingTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Update onboarding task details (task_name, due_date, status).
    Restricted to ADMIN and HR roles.
    """
    task = db.query(OnboardingTask).filter(OnboardingTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Onboarding task #{task_id} not found",
        )

    if task_in.task_name is not None:
        clean_name = task_in.task_name.strip()
        if not clean_name:
            raise HTTPException(
                status_code=http_status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Task name cannot be empty",
            )
        task.task_name = clean_name

    if task_in.due_date is not None:
        task.due_date = task_in.due_date

    if task_in.status is not None:
        task.status = task_in.status
        if task_in.status == OnboardingTaskStatus.COMPLETED:
            if not task.completed_at:
                task.completed_at = datetime.now()
        else:
            task.completed_at = None

    db.commit()
    db.refresh(task)
    return _to_task_response(task)


@router.delete("/{task_id}", status_code=http_status.HTTP_200_OK)
def delete_onboarding_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Delete an onboarding task.
    Restricted to ADMIN and HR roles.
    """
    task = db.query(OnboardingTask).filter(OnboardingTask.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Onboarding task #{task_id} not found",
        )

    db.delete(task)
    db.commit()
    return {"message": f"Onboarding task #{task_id} successfully deleted"}

