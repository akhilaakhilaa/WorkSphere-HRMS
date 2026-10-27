import os
import re
import uuid
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import (
    ALLOWED_DOCUMENT_EXTENSIONS,
    ALLOWED_DOCUMENT_MIME_TYPES,
    DOCUMENTS_UPLOAD_DIR,
    MAX_DOCUMENT_FILE_SIZE,
)
from app.database import get_db
from app.dependencies import get_current_employee, get_current_user, require_roles
from app.models.document import Document, DocumentType
from app.models.employee import Employee
from app.models.user import User, UserRole
from app.schemas.document import DocumentResponse, DocumentSummary

router = APIRouter(prefix="/documents", tags=["Module 16: Document Management"])


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable B, KB, or MB."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{round(size_bytes / 1024, 1)} KB"
    else:
        return f"{round(size_bytes / (1024 * 1024), 2)} MB"


def _to_document_response(doc: Document) -> DocumentResponse:
    emp = doc.employee
    uploader = doc.uploader
    return DocumentResponse(
        id=doc.id,
        employee_id=doc.employee_id,
        employee_name=emp.full_name if emp else None,
        department=emp.department if emp else None,
        file_name=doc.file_name,
        file_url=doc.file_url,
        original_file_name=doc.original_file_name,
        document_type=doc.document_type,
        file_size=doc.file_size,
        file_size_formatted=format_file_size(doc.file_size),
        content_type=doc.content_type,
        uploaded_at=doc.uploaded_at,
        uploaded_by=doc.uploaded_by,
        uploader_email=uploader.email if uploader else None,
        description=doc.description,
    )


def sanitize_filename(filename: str) -> str:
    """Sanitize original filename and protect against path traversal."""
    # Strip any directory components
    clean_name = os.path.basename(filename).strip()
    # Replace dangerous characters with underscores
    clean_name = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', clean_name)
    # Remove leading dots or hyphens
    clean_name = re.sub(r'^[.\-_]+', '', clean_name)
    if not clean_name:
        clean_name = "document"
    return clean_name


# -------------------------------------------------------------
# 1. DOCUMENT UPLOAD ENDPOINT
# -------------------------------------------------------------


@router.post("/upload", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    employee_id: Optional[int] = Form(None),
    document_type: DocumentType = Form(DocumentType.OTHER),
    description: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload an employee document securely.
    - Validates file type (PDF, JPG, JPEG, PNG).
    - Enforces 5 MB size limit.
    - Generates unique server-side filename and prevents path traversal.
    - Regular EMPLOYEE can only upload for themselves.
    - HR / ADMIN can upload for any employee.
    """
    # 1. Check path traversal in raw filename
    raw_name = file.filename or ""
    if ".." in raw_name or "/" in raw_name or "\\" in raw_name:
        # Detected path traversal attempt
        clean_original = sanitize_filename(raw_name)
    else:
        clean_original = sanitize_filename(raw_name)

    # 2. Validate file extension
    ext = Path(clean_original).suffix.lower()
    if ext not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file extension '{ext}'. Allowed extensions: "
                f"{', '.join(sorted(ALLOWED_DOCUMENT_EXTENSIONS))}."
            ),
        )

    # 3. Validate MIME type
    content_type = (file.content_type or "").lower().split(";")[0].strip()
    if content_type not in ALLOWED_DOCUMENT_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported MIME type '{content_type}'. Allowed types: "
                f"{', '.join(sorted(ALLOWED_DOCUMENT_MIME_TYPES))}."
            ),
        )

    # 4. Read file content & validate size
    content = await file.read()
    file_size = len(content)

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty (0 bytes).",
        )

    if file_size > MAX_DOCUMENT_FILE_SIZE:
        max_mb = MAX_DOCUMENT_FILE_SIZE // (1024 * 1024)
        status_413 = getattr(status, "HTTP_413_CONTENT_TOO_LARGE", 413)
        raise HTTPException(
            status_code=status_413,
            detail=f"File size ({format_file_size(file_size)}) exceeds maximum allowed limit of {max_mb} MB.",
        )

    # 5. Authorization & target employee resolution
    if current_user.role == UserRole.EMPLOYEE:
        my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not my_emp:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No employee profile found for current user account.",
            )
        if employee_id is not None and employee_id != my_emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Employees can only upload documents for their own profile.",
            )
        target_employee = my_emp
    else:
        # HR or ADMIN
        if employee_id is None:
            # Check if current user has an employee record
            my_emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
            if my_emp:
                target_employee = my_emp
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="employee_id is required when uploading as administrator without employee profile.",
                )
        else:
            target_employee = db.query(Employee).filter(Employee.id == employee_id).first()
            if not target_employee:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Employee #{employee_id} not found.",
                )

    # 6. Generate unique server-side filename
    unique_filename = f"{uuid.uuid4().hex}_{clean_original}"
    dest_path = (DOCUMENTS_UPLOAD_DIR / unique_filename).resolve()

    # Final path containment check
    if not str(dest_path).startswith(str(DOCUMENTS_UPLOAD_DIR)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Security violation: Invalid storage path.",
        )

    # 7. Write file to disk
    try:
        with open(dest_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to write document to storage: {str(e)}",
        )

    # 8. Store relative URL and database record
    relative_url = f"uploads/documents/{unique_filename}"
    new_doc = Document(
        employee_id=target_employee.id,
        file_name=unique_filename,
        file_url=relative_url,
        original_file_name=clean_original,
        document_type=document_type,
        file_size=file_size,
        content_type=content_type,
        uploaded_by=current_user.id,
        description=description.strip() if description else None,
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    return _to_document_response(new_doc)


# -------------------------------------------------------------
# 2. DOCUMENT LISTING & SUMMARY ENDPOINTS
# -------------------------------------------------------------


@router.get("", response_model=List[DocumentResponse])
def list_documents(
    employee_id: Optional[int] = Query(None, description="Filter by employee ID"),
    document_type: Optional[DocumentType] = Query(None, description="Filter by document type"),
    search: Optional[str] = Query(None, description="Search by file or employee name"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List documents visible to the current authenticated user.
    - Regular EMPLOYEE is restricted to viewing only their own documents.
    - HR and ADMIN can view all documents or filter by employee/type/search.
    """
    query = db.query(Document).join(Employee, Employee.id == Document.employee_id)

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee record not found.")
        if employee_id is not None and employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only view your own documents.",
            )
        query = query.filter(Document.employee_id == emp.id)
    else:
        if employee_id is not None:
            query = query.filter(Document.employee_id == employee_id)

    if document_type is not None:
        query = query.filter(Document.document_type == document_type)

    if search:
        s = f"%{search.strip()}%"
        query = query.filter(
            (Document.original_file_name.ilike(s)) | (Employee.full_name.ilike(s))
        )

    docs = query.order_by(Document.uploaded_at.desc()).offset(skip).limit(limit).all()
    return [_to_document_response(d) for d in docs]


@router.get("/summary", response_model=DocumentSummary)
def get_documents_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns aggregated document counts, storage usage, and type breakdowns.
    - EMPLOYEE receives metrics for their own documents.
    - HR / ADMIN receives organization-wide metrics.
    """
    query = db.query(Document)

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp:
            raise HTTPException(status_code=404, detail="Employee record not found.")
        query = query.filter(Document.employee_id == emp.id)

    docs = query.all()
    total_docs = len(docs)
    total_size = sum(d.file_size for d in docs)

    type_counts = {t.value: 0 for t in DocumentType}
    for d in docs:
        key = d.document_type.value if hasattr(d.document_type, "value") else str(d.document_type)
        type_counts[key] = type_counts.get(key, 0) + 1

    return DocumentSummary(
        total_documents=total_docs,
        total_size_bytes=total_size,
        total_size_formatted=format_file_size(total_size),
        type_breakdown=type_counts,
    )


# -------------------------------------------------------------
# 3. INDIVIDUAL DOCUMENT ENDPOINTS (VIEW, DOWNLOAD, DETAILS, DELETE)
# -------------------------------------------------------------


@router.get("/{document_id}", response_model=DocumentResponse)
def get_document_details(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get detailed metadata of a specific document.
    - EMPLOYEE restricted to their own document.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document #{document_id} not found.",
        )

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or doc.employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to inspect this document.",
            )

    return _to_document_response(doc)


@router.get("/{document_id}/download")
def download_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Securely download a document as an attachment.
    - Validates caller permissions.
    - Protects against path traversal.
    - Never exposes absolute server paths.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document #{document_id} not found.",
        )

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or doc.employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to download this document.",
            )

    file_path = (DOCUMENTS_UPLOAD_DIR / doc.file_name).resolve()
    if not str(file_path).startswith(str(DOCUMENTS_UPLOAD_DIR)) or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on storage.",
        )

    return FileResponse(
        path=file_path,
        filename=doc.original_file_name,
        media_type=doc.content_type,
        content_disposition_type="attachment",
    )


@router.get("/{document_id}/view")
def view_document_inline(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Securely stream document inline for in-browser previewing (PDFs and images).
    - Validates caller permissions.
    - Protects against path traversal.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document #{document_id} not found.",
        )

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or doc.employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You do not have permission to view this document.",
            )

    file_path = (DOCUMENTS_UPLOAD_DIR / doc.file_name).resolve()
    if not str(file_path).startswith(str(DOCUMENTS_UPLOAD_DIR)) or not file_path.is_file():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document file not found on storage.",
        )

    return FileResponse(
        path=file_path,
        filename=doc.original_file_name,
        media_type=doc.content_type,
        content_disposition_type="inline",
    )


@router.delete("/{document_id}")
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a document record and remove its stored file from disk.
    - ADMIN and HR can delete any document.
    - Regular EMPLOYEE can only delete their own document.
    """
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document #{document_id} not found.",
        )

    if current_user.role == UserRole.EMPLOYEE:
        emp = db.query(Employee).filter(Employee.user_id == current_user.id).first()
        if not emp or doc.employee_id != emp.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You cannot delete another employee's document.",
            )

    # Remove physical file from disk
    file_path = (DOCUMENTS_UPLOAD_DIR / doc.file_name).resolve()
    if str(file_path).startswith(str(DOCUMENTS_UPLOAD_DIR)) and file_path.is_file():
        try:
            file_path.unlink()
        except Exception:
            pass  # Do not block DB deletion if file was already removed

    doc_name = doc.original_file_name
    db.delete(doc)
    db.commit()

    return {
        "message": f"Document '{doc_name}' (ID #{document_id}) has been successfully deleted.",
        "deleted_document_id": document_id,
    }
