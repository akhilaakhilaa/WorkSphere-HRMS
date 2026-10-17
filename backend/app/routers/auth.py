from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.config import ACCESS_TOKEN_EXPIRE_MINUTES
from app.database import get_db
from app.dependencies import get_current_user
from app.models.employee import Employee
from app.models.user import User, UserRole
from app.schemas.user import Token, UserCreate, UserLogin, UserResponse
from app.utils.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["Authentication & Roles"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    """Registers a new user account."""
    existing_user = db.query(User).filter(User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists",
        )

    # Validate role
    role = user_in.role if user_in.role else UserRole.EMPLOYEE

    new_user = User(
        email=user_in.email,
        password_hash=hash_password(user_in.password),
        role=role,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        email=new_user.email,
        role=new_user.role,
        is_active=new_user.is_active,
        created_at=new_user.created_at,
        employee_id=None,
        full_name=None,
    )


@router.post("/login", response_model=Token)
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Authenticates user credentials and returns a JWT access token."""
    user = db.query(User).filter(User.email == login_data.email).first()
    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive. Please contact your administrator.",
        )

    # Fetch linked employee profile if existing
    employee = db.query(Employee).filter(Employee.user_id == user.id).first()
    employee_id = employee.id if employee else None
    full_name = employee.full_name if employee else None

    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    token_payload = {
        "sub": str(user.id),
        "role": user.role.value,
        "email": user.email,
    }
    token = create_access_token(token_payload, expires_delta=access_token_expires)

    return Token(
        access_token=token,
        token_type="bearer",
        role=user.role,
        user_id=user.id,
        email=user.email,
        employee_id=employee_id,
        full_name=full_name,
    )


@router.get("/me", response_model=UserResponse)
def get_me(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Returns currently authenticated user profile."""
    employee = db.query(Employee).filter(Employee.user_id == current_user.id).first()
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at,
        employee_id=employee.id if employee else None,
        full_name=employee.full_name if employee else None,
    )

