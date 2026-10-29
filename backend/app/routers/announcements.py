"""
Internal Announcements System Router
WorkSphere HRMS - Module 23
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models.announcement import Announcement
from app.models.notification import NotificationType
from app.models.user import User, UserRole
from app.schemas.announcement import (
    AnnouncementCreate,
    AnnouncementResponse,
    AnnouncementUpdate,
)
from app.utils.notifications import notify_all_users

router = APIRouter(prefix="/announcements", tags=["Module 23: Internal Announcements System"])


def _to_announcement_response(a: Announcement) -> AnnouncementResponse:
    """Helper to convert Announcement ORM model to AnnouncementResponse schema."""
    creator = a.creator
    creator_name = None
    if creator:
        if creator.employee and creator.employee.full_name:
            creator_name = creator.employee.full_name
        else:
            creator_name = creator.username

    return AnnouncementResponse(
        id=a.id,
        title=a.title,
        message=a.message,
        created_by=a.created_by,
        creator_name=creator_name,
        creator_email=creator.email if creator else None,
        creator_role=creator.role.value if creator and creator.role else None,
        created_at=a.created_at,
        updated_at=a.updated_at,
    )


# --------------------------------------------------------------------------
# 1. Create Announcement (HR & Admin only)
# --------------------------------------------------------------------------
@router.post("", response_model=AnnouncementResponse, status_code=status.HTTP_201_CREATED)
def create_announcement(
    announcement_in: AnnouncementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Publish a new company announcement.
    Restricted to HR and ADMIN roles.
    """
    if current_user.role not in (UserRole.HR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only HR and Admin users can publish announcements.",
        )

    clean_title = announcement_in.title.strip()
    clean_message = announcement_in.message.strip()

    if len(clean_title) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Announcement title must be at least 3 characters long.",
        )

    if len(clean_message) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Announcement message must be at least 5 characters long.",
        )

    new_announcement = Announcement(
        title=clean_title,
        message=clean_message,
        created_by=current_user.id,
    )
    db.add(new_announcement)
    db.commit()
    db.refresh(new_announcement)

    # Broadcast notification to all active users
    try:
        notify_all_users(
            db=db,
            title="Company Announcement",
            message=f"{clean_title}: {clean_message[:100]}...",
            notif_type=NotificationType.SYSTEM,
            link="/announcements",
            related_entity_id=new_announcement.id,
        )
        db.commit()
    except Exception:
        # Non-blocking notification dispatch
        pass

    return _to_announcement_response(new_announcement)


# --------------------------------------------------------------------------
# 2. List Announcements (All Authenticated Users)
# --------------------------------------------------------------------------
@router.get("", response_model=List[AnnouncementResponse])
def list_announcements(
    search: Optional[str] = Query(None, description="Search keyword in title or message"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve all published announcements, ordered by newest first.
    Accessible to all authenticated users.
    """
    query = db.query(Announcement)

    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            (Announcement.title.ilike(term)) | (Announcement.message.ilike(term))
        )

    records = query.order_by(Announcement.id.desc()).offset(skip).limit(limit).all()
    return [_to_announcement_response(a) for a in records]


# --------------------------------------------------------------------------
# 3. Get Announcement Details (All Authenticated Users)
# --------------------------------------------------------------------------
@router.get("/{announcement_id}", response_model=AnnouncementResponse)
def get_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retrieve detailed announcement by ID.
    Accessible to all authenticated users.
    """
    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement #{announcement_id} not found.",
        )

    return _to_announcement_response(announcement)


# --------------------------------------------------------------------------
# 4. Update Announcement (HR & Admin only)
# --------------------------------------------------------------------------
@router.put("/{announcement_id}", response_model=AnnouncementResponse)
def update_announcement(
    announcement_id: int,
    announcement_in: AnnouncementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update an existing announcement's title or message.
    Restricted to HR and ADMIN roles.
    """
    if current_user.role not in (UserRole.HR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only HR and Admin users can update announcements.",
        )

    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement #{announcement_id} not found.",
        )

    if announcement_in.title is not None:
        clean_title = announcement_in.title.strip()
        if len(clean_title) < 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Announcement title must be at least 3 characters long.",
            )
        announcement.title = clean_title

    if announcement_in.message is not None:
        clean_message = announcement_in.message.strip()
        if len(clean_message) < 5:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Announcement message must be at least 5 characters long.",
            )
        announcement.message = clean_message

    db.commit()
    db.refresh(announcement)
    return _to_announcement_response(announcement)


# --------------------------------------------------------------------------
# 5. Delete Announcement (HR & Admin only)
# --------------------------------------------------------------------------
@router.delete("/{announcement_id}", status_code=status.HTTP_200_OK)
def delete_announcement(
    announcement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete an announcement.
    Restricted to HR and ADMIN roles.
    """
    if current_user.role not in (UserRole.HR, UserRole.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Only HR and Admin users can delete announcements.",
        )

    announcement = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not announcement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Announcement #{announcement_id} not found.",
        )

    db.delete(announcement)
    db.commit()
    return {"message": f"Announcement #{announcement_id} deleted successfully."}

