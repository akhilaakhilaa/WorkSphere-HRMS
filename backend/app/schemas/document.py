from datetime import datetime
from typing import Dict, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.document import DocumentType


class DocumentBase(BaseModel):
    document_type: DocumentType = DocumentType.OTHER
    description: Optional[str] = Field(None, max_length=500)


class DocumentResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: Optional[str] = None
    department: Optional[str] = None
    file_name: str
    file_url: str
    original_file_name: str
    document_type: DocumentType
    file_size: int
    file_size_formatted: Optional[str] = None
    content_type: str
    uploaded_at: datetime
    uploaded_by: Optional[int] = None
    uploader_email: Optional[str] = None
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class DocumentSummary(BaseModel):
    total_documents: int
    total_size_bytes: int
    total_size_formatted: str
    type_breakdown: Dict[str, int]

