from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth_utils import (
    get_password_hash,
    verify_password,
    create_access_token,
    get_current_user
)


router = APIRouter(
    tags=["Authentication"]
)


class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str


# Register endpoint
@router.post("/register/")
def register_user(
    user_data: schemas.UserCreate,
    db: Session = Depends(get_db)
):
    db_user = db.query(models.User).filter(
        models.User.email == user_data.email
    ).first()

    if db_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    hashed_password = get_password_hash(
        user_data.password
    )

    new_user = models.User(
        full_name=user_data.full_name,
        email=user_data.email,
        hashed_password=hashed_password
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    access_token = create_access_token(
        data={"sub": str(new_user.id)}
    )

    return {
        "message": "Account created successfully",
        "access_token": access_token,
        "token_type": "bearer"
    }


# Login endpoint
@router.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        models.User.email == form_data.username
    ).first()

    if not user or not verify_password(
        form_data.password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": str(user.id)}
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# Get current user
@router.get("/users/me", response_model=schemas.UserResponse)
def get_me(
    current_user: models.User = Depends(get_current_user)
):
    return current_user


# Update password
@router.put("/users/update-password")
async def update_user_password(
    data: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not verify_password(
        data.old_password,
        current_user.hashed_password
    ):
        raise HTTPException(
            status_code=400,
            detail="Incorrect old password"
        )

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 8 characters"
        )

    current_user.hashed_password = get_password_hash(
        data.new_password
    )

    db.commit()

    return {
        "message": "Password updated successfully"
    }
