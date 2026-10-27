import enum
from sqlalchemy import Column, DateTime, Enum as SQLEnum, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from app.database import Base


class DocumentType(str, enum.Enum):
    IDENTITY = "IDENTITY"
    CERTIFICATE = "CERTIFICATE"
    EDUCATION = "EDUCATION"
    EMPLOYMENT = "EMPLOYMENT"
    OTHER = "OTHER"


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    employee_id = Column(
        Integer,
        ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    uploaded_at = Column(DateTime, server_default=func.now(), nullable=False, index=True)
    original_file_name = Column(String(255), nullable=False)
    document_type = Column(
        SQLEnum(DocumentType, values_callable=lambda obj: [e.value for e in obj]),
        default=DocumentType.OTHER,
        nullable=False,
        index=True,
    )
    file_size = Column(Integer, nullable=False, default=0)
    content_type = Column(String(100), nullable=False)
    uploaded_by = Column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    description = Column(String(500), nullable=True)

    # Relationships
    employee = relationship("Employee", back_populates="documents")
    uploader = relationship("User", foreign_keys=[uploaded_by])

    def __repr__(self):
        return f"<Document id={self.id} employee_id={self.employee_id} file_name={self.file_name} type={self.document_type}>"

