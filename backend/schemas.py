from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List
from datetime import date, datetime


class ProjectUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_type: Optional[str] = None
    status: Optional[str] = None
    location: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class UserCreate(BaseModel):
    full_name: str
    email: str
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


class TeamMemberCreate(BaseModel):
    full_name: str
    email: EmailStr
    role: Optional[str] = "Engineer"
    department: Optional[str] = "General"
    access_level: Optional[str] = "Viewer"
    status: Optional[str] = "Active"


class TeamMemberUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    department: Optional[str] = None
    access_level: Optional[str] = None
    status: Optional[str] = None


class TeamMemberResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    department: str
    access_level: str
    status: str
    owner_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


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


class ProjectWithTeamResponse(BaseModel):
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
    team_members: List[TeamMemberResponse] = []

    class Config:
        from_attributes = True


class ProjectStats(BaseModel):
    active: int
    pending: int
    completed: int
    total: int


class MessageResponse(BaseModel):
    message: str

class ProjectTaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    status: Optional[str] = "Pending"
    due_date: Optional[date] = None
    assigned_member_id: Optional[int] = None


class ProjectTaskCreate(ProjectTaskBase):
    pass


class ProjectTaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    due_date: Optional[date] = None
    assigned_member_id: Optional[int] = None


class ProjectTaskResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    status: str
    due_date: Optional[date] = None

    project_id: int
    assigned_member_id: Optional[int] = None
    assigned_member_name: Optional[str] = None
    assigned_member_email: Optional[str] = None
    assigned_member_role: Optional[str] = None

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class ProjectRiskMetrics(BaseModel):
    total_tasks: int
    completed_tasks: int
    pending_tasks: int
    in_progress_tasks: int
    overdue_tasks: int
    due_soon_tasks: int
    unassigned_tasks: int
    team_members: int
    completion_rate: int


class ProjectRiskAssessmentResponse(BaseModel):
    project_id: int
    risk_score: int
    risk_level: str
    risk_color: str
    summary: str
    factors: List[str]
    recommendations: List[str]
    metrics: ProjectRiskMetrics

class UserRoleUpdate(BaseModel):
    role: str

class UserRoleUpdate(BaseModel):
    role: str
