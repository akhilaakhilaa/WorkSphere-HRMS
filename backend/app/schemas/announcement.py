from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


class AnnouncementBase(BaseModel):
    title: str = Field(..., min_length=3, max_length=255, description="Title of the announcement")
    message: str = Field(..., min_length=5, max_length=10000, description="Full message/body of the announcement")

    @field_validator("title")
    @classmethod
    def validate_title(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 3:
            raise ValueError("Title must be at least 3 characters long")
        return cleaned

    @field_validator("message")
    @classmethod
    def validate_message(cls, v: str) -> str:
        cleaned = v.strip()
        if len(cleaned) < 5:
            raise ValueError("Message must be at least 5 characters long")
        return cleaned


class AnnouncementCreate(AnnouncementBase):
    pass


class AnnouncementUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=255)
    message: Optional[str] = Field(None, min_length=5, max_length=10000)

    @field_validator("title")
    @classmethod
    def validate_optional_title(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if len(cleaned) < 3:
                raise ValueError("Title must be at least 3 characters long")
            return cleaned
        return v

    @field_validator("message")
    @classmethod
    def validate_optional_message(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            cleaned = v.strip()
            if len(cleaned) < 5:
                raise ValueError("Message must be at least 5 characters long")
            return cleaned
        return v


class AnnouncementResponse(AnnouncementBase):
    id: int
    created_by: int
    creator_name: Optional[str] = None
    creator_email: Optional[str] = None
    creator_role: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

