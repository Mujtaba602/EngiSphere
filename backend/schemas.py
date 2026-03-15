from pydantic import BaseModel
from typing import List, Optional

class ProjectBase(BaseModel):
    title: str
    description: str
    status: str = "Pending"

class ProjectCreate(ProjectBase):
    owner_id: int

class Project(ProjectBase):
    id: int
    owner_id: int

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    full_name: str
    email: str
    user_type: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    projects: List[Project] = []

    class Config:
        from_attributes = True