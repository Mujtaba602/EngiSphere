from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

import models
import schemas
from database import get_db
from rbac_utils import require_admin

router = APIRouter(
    prefix="/admin/users",
    tags=["Admin User Management"],
    dependencies=[Depends(require_admin)]
)

VALID_ROLES = ["admin", "manager", "engineer", "viewer"]

@router.get("/", response_model=List[schemas.UserResponse])
def get_all_users(db: Session = Depends(get_db)):
    """
    Returns a list of all users. Only accessible by admins.
    """
    return db.query(models.User).all()

@router.patch("/{user_id}/role", response_model=schemas.UserResponse)
def update_user_role(
    user_id: int, 
    role_update: schemas.UserRoleUpdate, 
    db: Session = Depends(get_db)
):
    """
    Updates the role of a specific user.
    """
    new_role = role_update.role.strip().lower()
    if new_role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}"
        )
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.role = new_role
    db.commit()
    db.refresh(user)
    return user

@router.patch("/{user_id}/status", response_model=schemas.UserResponse)
def update_user_status(
    user_id: int, 
    status_update: schemas.UserStatusUpdate, 
    db: Session = Depends(get_db)
):
    """
    Activates or deactivates a user.
    """
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.is_active = status_update.is_active
    db.commit()
    db.refresh(user)
    return user
