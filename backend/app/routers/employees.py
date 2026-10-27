from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from sqlalchemy import cast, or_, String
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.attendance import Attendance, AttendanceStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.performance import PerformanceReview
from app.models.user import User, UserRole
from app.schemas.employee import (
    EmployeeCreate,
    EmployeeResponse,
    EmployeeSearchItemResponse,
    EmployeeSearchPaginationResponse,
    EmployeeUpdate,
)
from app.utils.security import hash_password

router = APIRouter(prefix="/employees", tags=["Employee Management"])


@router.get("", response_model=List[EmployeeResponse])
def list_employees(
    q: Optional[str] = Query(None, description="Search by name, department, or designation"),
    department: Optional[str] = Query(None, description="Filter by department"),
    status: Optional[EmployeeStatus] = Query(None, description="Filter by status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_roles([UserRole.ADMIN, UserRole.HR])
    ),
):
    """
    List and search employees.
    Accessible to all authenticated users (ADMIN, HR, EMPLOYEE).
    """
    query = db.query(Employee)

    if q:
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Employee.full_name.ilike(search_pattern),
                Employee.department.ilike(search_pattern),
                Employee.designation.ilike(search_pattern),
            )
        )

    if department:
        query = query.filter(Employee.department == department)

    if status:
        query = query.filter(Employee.status == status)

    employees = query.order_by(Employee.id.desc()).offset(skip).limit(limit).all()

    # Enrich with user_email if linked
    results = []
    for emp in employees:
        emp_resp = EmployeeResponse(
            id=emp.id,
            user_id=emp.user_id,
            user_email=emp.user.email if emp.user else None,
            role=emp.user.role.value if emp.user and emp.user.role else None,
            full_name=emp.full_name,
            designation=emp.designation,
            department=emp.department,
            joining_date=emp.joining_date,
            salary=emp.salary,
            status=emp.status,
            created_at=emp.created_at,
            updated_at=emp.updated_at,
        )
        results.append(emp_resp)

    return results


@router.get("/search", response_model=EmployeeSearchPaginationResponse)
def search_employees(
    q: Optional[str] = Query(None, description="Search by full name, department, designation, or role"),
    department: Optional[str] = Query(None, description="Filter by department"),
    role: Optional[str] = Query(None, description="Filter by user role: EMPLOYEE, HR, ADMIN"),
    status: Optional[str] = Query(None, description="Filter by employment status: ACTIVE, INACTIVE, ON_LEAVE, TERMINATED"),
    attendance_status: Optional[str] = Query(None, description="Filter by attendance status: PRESENT, ABSENT, LATE, HALF_DAY"),
    attendance_date: Optional[date] = Query(None, description="Reference date for attendance status (defaults to today)"),
    performance: Optional[str] = Query(None, description="Filter by performance rating: HIGH (>=4), AVERAGE (3), LOW (<=2), or 1-5"),
    sort_by: str = Query("id", description="Field to sort by: id, full_name, department, designation, joining_date, salary, status, created_at"),
    sort_order: str = Query("asc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Advanced employee search, multi-filter, sorting, and pagination.
    Restricted to ADMIN and HR roles.
    """
    query = db.query(Employee).outerjoin(User, Employee.user_id == User.id)

    # 1. Search Query (q)
    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Employee.full_name.ilike(search_pattern),
                Employee.department.ilike(search_pattern),
                Employee.designation.ilike(search_pattern),
                cast(User.role, String).ilike(search_pattern),
            )
        )

    # 2. Department Filter
    if department and department.strip() and department.strip().lower() != "all departments":
        query = query.filter(Employee.department == department.strip())

    # 3. Role Filter
    if role and role.strip() and role.strip().lower() != "all roles":
        r_val = role.strip().upper()
        valid_roles = {r.value for r in UserRole}
        if r_val not in valid_roles:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid role '{role}'. Valid options: {', '.join(sorted(valid_roles))}",
            )
        query = query.filter(User.role == UserRole(r_val))

    # 4. Status Filter
    if status and status.strip() and status.strip().lower() != "all statuses":
        s_val = status.strip().upper()
        valid_statuses = {s.value for s in EmployeeStatus}
        if s_val not in valid_statuses:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status '{status}'. Valid options: {', '.join(sorted(valid_statuses))}",
            )
        query = query.filter(Employee.status == EmployeeStatus(s_val))

    # 5. Attendance Status Filter
    ref_date = attendance_date or date.today()
    if attendance_status and attendance_status.strip() and attendance_status.strip().lower() != "all":
        att_val = attendance_status.strip().upper()
        valid_attendance = {"PRESENT", "ABSENT", "LATE", "HALF_DAY"}
        if att_val not in valid_attendance:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid attendance_status '{attendance_status}'. Valid options: {', '.join(sorted(valid_attendance))}",
            )
        att_subquery = db.query(Attendance.employee_id).filter(Attendance.date == ref_date)
        if att_val == "LATE":
            att_subquery = att_subquery.filter(Attendance.is_late == True)
        elif att_val == "PRESENT":
            att_subquery = att_subquery.filter(Attendance.status == AttendanceStatus.PRESENT)
        elif att_val == "ABSENT":
            att_subquery = att_subquery.filter(Attendance.status == AttendanceStatus.ABSENT)
        elif att_val == "HALF_DAY":
            att_subquery = att_subquery.filter(Attendance.status == AttendanceStatus.HALF_DAY)
        query = query.filter(Employee.id.in_(att_subquery))

    # 6. Performance Filter
    if performance and performance.strip() and performance.strip().lower() != "all":
        p_val = performance.strip().upper()
        valid_perf = {"HIGH", "AVERAGE", "LOW", "1", "2", "3", "4", "5"}
        if p_val not in valid_perf:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid performance filter '{performance}'. Valid options: HIGH (rating >= 4), AVERAGE (rating == 3), LOW (rating <= 2), or 1-5",
            )
        perf_subquery = db.query(PerformanceReview.employee_id)
        if p_val == "HIGH":
            perf_subquery = perf_subquery.filter(PerformanceReview.rating >= 4)
        elif p_val == "AVERAGE":
            perf_subquery = perf_subquery.filter(PerformanceReview.rating == 3)
        elif p_val == "LOW":
            perf_subquery = perf_subquery.filter(PerformanceReview.rating <= 2)
        elif p_val in ["1", "2", "3", "4", "5"]:
            perf_subquery = perf_subquery.filter(PerformanceReview.rating == int(p_val))
        query = query.filter(Employee.id.in_(perf_subquery))

    # 7. Sorting
    sort_fields = {
        "id": Employee.id,
        "full_name": Employee.full_name,
        "department": Employee.department,
        "designation": Employee.designation,
        "joining_date": Employee.joining_date,
        "salary": Employee.salary,
        "status": Employee.status,
        "created_at": Employee.created_at,
    }
    if sort_by.lower() not in sort_fields:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort_by field '{sort_by}'. Valid options: {', '.join(sorted(sort_fields.keys()))}",
        )
    if sort_order.lower() not in ["asc", "desc"]:
        raise HTTPException(
            status_code=http_status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid sort_order '{sort_order}'. Valid options: asc, desc",
        )

    col = sort_fields[sort_by.lower()]
    if sort_order.lower() == "desc":
        query = query.order_by(col.desc(), Employee.id.desc())
    else:
        query = query.order_by(col.asc(), Employee.id.asc())

    # 8. Pagination and Count
    total = query.count()
    offset = (page - 1) * page_size
    employees = query.offset(offset).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 0

    # 9. Batch Enrichment (Attendance & Performance)
    emp_ids = [e.id for e in employees]
    att_map = {}
    perf_map = {}
    if emp_ids:
        attendances = (
            db.query(Attendance)
            .filter(Attendance.employee_id.in_(emp_ids), Attendance.date == ref_date)
            .all()
        )
        att_map = {att.employee_id: att for att in attendances}

        reviews = (
            db.query(PerformanceReview)
            .filter(PerformanceReview.employee_id.in_(emp_ids))
            .order_by(PerformanceReview.id.desc())
            .all()
        )
        for r in reviews:
            if r.employee_id not in perf_map:
                perf_map[r.employee_id] = r

    items = []
    for emp in employees:
        att = att_map.get(emp.id)
        att_status = None
        is_late = False
        if att:
            if att.is_late:
                att_status = "LATE"
            else:
                att_status = att.status.value
            is_late = att.is_late

        rev = perf_map.get(emp.id)
        perf_rating = None
        perf_level = "NO_REVIEW"
        if rev:
            perf_rating = float(rev.rating)
            if rev.rating >= 4:
                perf_level = "HIGH"
            elif rev.rating == 3:
                perf_level = "AVERAGE"
            else:
                perf_level = "LOW"

        user_role = emp.user.role.value if emp.user and emp.user.role else None

        items.append(
            EmployeeSearchItemResponse(
                id=emp.id,
                user_id=emp.user_id,
                user_email=emp.user.email if emp.user else None,
                full_name=emp.full_name,
                designation=emp.designation,
                department=emp.department,
                role=user_role,
                status=emp.status,
                joining_date=emp.joining_date,
                salary=emp.salary,
                attendance_status=att_status,
                is_late=is_late,
                performance_rating=perf_rating,
                performance_level=perf_level,
                created_at=emp.created_at,
                updated_at=emp.updated_at,
            )
        )

    return EmployeeSearchPaginationResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )



@router.get("/me/profile", response_model=EmployeeResponse)
def get_my_employee_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current authenticated user's employee profile."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for current user account",
        )

    return EmployeeResponse(
        id=emp.id,
        user_id=emp.user_id,
        user_email=current_user.email,
        role=current_user.role.value if current_user.role else None,
        full_name=emp.full_name,
        designation=emp.designation,
        department=emp.department,
        joining_date=emp.joining_date,
        salary=emp.salary,
        status=emp.status,
        created_at=emp.created_at,
        updated_at=emp.updated_at,
    )


@router.get("/{employee_id}", response_model=EmployeeResponse)
def get_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get an employee by ID with role-based access control."""

    emp = db.query(Employee).filter(Employee.id == employee_id).first()

    if not emp:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found",
        )

    # HR and ADMIN can view any employee.
    if current_user.role not in [UserRole.ADMIN, UserRole.HR]:
        # Employees can view only their own profile.
        if emp.user_id != current_user.id:
            raise HTTPException(
                status_code=http_status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to view this employee's details",
            )

    return EmployeeResponse(
        id=emp.id,
        user_id=emp.user_id,
        user_email=emp.user.email if emp.user else None,
        role=emp.user.role.value if emp.user and emp.user.role else None,
        full_name=emp.full_name,
        designation=emp.designation,
        department=emp.department,
        joining_date=emp.joining_date,
        salary=emp.salary,
        status=emp.status,
        created_at=emp.created_at,
        updated_at=emp.updated_at,
    )


@router.post("", response_model=EmployeeResponse, status_code=http_status.HTTP_201_CREATED)
def create_employee(
    emp_in: EmployeeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Create a new employee profile.
    Can also optionally create and link a User login account.
    Restricted to ADMIN and HR roles.
    """
    assigned_user_id = emp_in.user_id

    # If requested to create a user account simultaneously
    if emp_in.create_user_account and emp_in.user_email and emp_in.user_password:
        existing_user = db.query(User).filter(User.email == emp_in.user_email).first()
        if existing_user:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"User with email '{emp_in.user_email}' already exists",
            )
        new_user = User(
            email=emp_in.user_email,
            password_hash=hash_password(emp_in.user_password),
            role=UserRole.EMPLOYEE,
            is_active=True,
        )
        db.add(new_user)
        db.flush()  # to obtain new_user.id
        assigned_user_id = new_user.id

    elif assigned_user_id:
        # Check that user exists and is not already linked to another employee
        existing_user = db.query(User).filter(User.id == assigned_user_id).first()
        if not existing_user:
            raise HTTPException(
                status_code=http_status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {assigned_user_id} not found",
            )
        already_linked = db.query(Employee).filter(Employee.user_id == assigned_user_id).first()
        if already_linked:
            raise HTTPException(
                status_code=http_status.HTTP_400_BAD_REQUEST,
                detail=f"User ID {assigned_user_id} is already linked to employee '{already_linked.full_name}'",
            )

    new_emp = Employee(
        user_id=assigned_user_id,
        full_name=emp_in.full_name.strip(),
        designation=emp_in.designation.strip(),
        department=emp_in.department.strip(),
        joining_date=emp_in.joining_date,
        salary=emp_in.salary,
        status=emp_in.status,
    )
    db.add(new_emp)
    db.commit()
    db.refresh(new_emp)

    user_email = new_emp.user.email if new_emp.user else None
    user_role = new_emp.user.role.value if new_emp.user and new_emp.user.role else None

    return EmployeeResponse(
        id=new_emp.id,
        user_id=new_emp.user_id,
        user_email=user_email,
        role=user_role,
        full_name=new_emp.full_name,
        designation=new_emp.designation,
        department=new_emp.department,
        joining_date=new_emp.joining_date,
        salary=new_emp.salary,
        status=new_emp.status,
        created_at=new_emp.created_at,
        updated_at=new_emp.updated_at,
    )


@router.put("/{employee_id}", response_model=EmployeeResponse)
def update_employee(
    employee_id: int,
    emp_in: EmployeeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN, UserRole.HR])),
):
    """
    Update employee profile details.
    Restricted to ADMIN and HR roles.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found",
        )

    if emp_in.full_name is not None:
        emp.full_name = emp_in.full_name.strip()
    if emp_in.designation is not None:
        emp.designation = emp_in.designation.strip()
    if emp_in.department is not None:
        emp.department = emp_in.department.strip()
    if emp_in.joining_date is not None:
        emp.joining_date = emp_in.joining_date
    if emp_in.salary is not None:
        emp.salary = emp_in.salary
    if emp_in.status is not None:
        emp.status = emp_in.status

    if emp_in.user_id is not None:
        if emp_in.user_id != emp.user_id:
            # Check user exists and not linked elsewhere
            target_user = db.query(User).filter(User.id == emp_in.user_id).first()
            if not target_user:
                raise HTTPException(
                    status_code=http_status.HTTP_404_NOT_FOUND,
                    detail=f"User with ID {emp_in.user_id} not found",
                )
            linked = (
                db.query(Employee)
                .filter(Employee.user_id == emp_in.user_id, Employee.id != employee_id)
                .first()
            )
            if linked:
                raise HTTPException(
                    status_code=http_status.HTTP_400_BAD_REQUEST,
                    detail=f"User ID {emp_in.user_id} is already linked to employee '{linked.full_name}'",
                )
            emp.user_id = emp_in.user_id

    db.commit()
    db.refresh(emp)

    return EmployeeResponse(
        id=emp.id,
        user_id=emp.user_id,
        user_email=emp.user.email if emp.user else None,
        role=emp.user.role.value if emp.user and emp.user.role else None,
        full_name=emp.full_name,
        designation=emp.designation,
        department=emp.department,
        joining_date=emp.joining_date,
        salary=emp.salary,
        status=emp.status,
        created_at=emp.created_at,
        updated_at=emp.updated_at,
    )


@router.delete("/{employee_id}", status_code=http_status.HTTP_200_OK)
def delete_employee(
    employee_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles([UserRole.ADMIN])),
):
    """
    Delete an employee. Restricted to ADMIN role.
    """
    emp = db.query(Employee).filter(Employee.id == employee_id).first()
    if not emp:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found",
        )

    db.delete(emp)
    db.commit()

    return {"message": f"Employee {emp.full_name} (ID: {employee_id}) successfully deleted"}

