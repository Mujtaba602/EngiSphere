from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    is_active: bool

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    title: str
    location: str
    status: str
    description: Optional[str] = "No description"
    project_type: Optional[str] = "General"


class ProjectResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    location: str
    project_type: str
    risk_level: str
    weather_data: str
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectStats(BaseModel):
    active: int
    pending: int
    completed: int
    total: int