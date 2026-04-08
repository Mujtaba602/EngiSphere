from pydantic import BaseModel


class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    is_active: bool

    class Config:
       from_attributes = True


class ProjectCreate(BaseModel):
    title: str
    description: str
    status: str

class ProjectResponse(ProjectCreate):
    id: int
    owner_id: int 

    class Config:
        from_attributes = True