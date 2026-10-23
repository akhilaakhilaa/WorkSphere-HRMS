from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models.employee import Employee, EmployeeStatus
from app.models.user import User, UserRole
from app.schemas.employee import EmployeeCreate, EmployeeResponse, EmployeeUpdate
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


@router.get("/me/profile", response_model=EmployeeResponse)
def get_my_employee_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the current authenticated user's employee profile."""
    emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    if not emp:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No employee profile found for current user account",
        )

    return EmployeeResponse(
        id=emp.id,
        user_id=emp.user_id,
        user_email=current_user.email,
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found",
        )

    # HR and ADMIN can view any employee.
    if current_user.role not in [UserRole.ADMIN, UserRole.HR]:
        # Employees can view only their own profile.
        if emp.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not allowed to view this employee's details",
            )

    return EmployeeResponse(
        id=emp.id,
        user_id=emp.user_id,
        user_email=emp.user.email if emp.user else None,
        full_name=emp.full_name,
        designation=emp.designation,
        department=emp.department,
        joining_date=emp.joining_date,
        salary=emp.salary,
        status=emp.status,
        created_at=emp.created_at,
        updated_at=emp.updated_at,
    )


@router.post("", response_model=EmployeeResponse, status_code=status.HTTP_201_CREATED)
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
                status_code=status.HTTP_400_BAD_REQUEST,
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
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {assigned_user_id} not found",
            )
        already_linked = db.query(Employee).filter(Employee.user_id == assigned_user_id).first()
        if already_linked:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
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

    return EmployeeResponse(
        id=new_emp.id,
        user_id=new_emp.user_id,
        user_email=user_email,
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
            status_code=status.HTTP_404_NOT_FOUND,
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
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"User with ID {emp_in.user_id} not found",
                )
            linked = (
                db.query(Employee)
                .filter(Employee.user_id == emp_in.user_id, Employee.id != employee_id)
                .first()
            )
            if linked:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"User ID {emp_in.user_id} is already linked to employee '{linked.full_name}'",
                )
            emp.user_id = emp_in.user_id

    db.commit()
    db.refresh(emp)

    return EmployeeResponse(
        id=emp.id,
        user_id=emp.user_id,
        user_email=emp.user.email if emp.user else None,
        full_name=emp.full_name,
        designation=emp.designation,
        department=emp.department,
        joining_date=emp.joining_date,
        salary=emp.salary,
        status=emp.status,
        created_at=emp.created_at,
        updated_at=emp.updated_at,
    )


@router.delete("/{employee_id}", status_code=status.HTTP_200_OK)
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
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Employee with ID {employee_id} not found",
        )

    db.delete(emp)
    db.commit()

    return {"message": f"Employee {emp.full_name} (ID: {employee_id}) successfully deleted"}

