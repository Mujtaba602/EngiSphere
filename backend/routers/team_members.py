from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth_utils import get_current_user


router = APIRouter(
    tags=["Team Members"]
)


def ensure_project_owner(
    project_id: int,
    db: Session,
    current_user: models.User
):
    project = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.owner_id == current_user.id
    ).first()

    if not project:
        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    return project


def ensure_team_member_owner(
    member_id: int,
    db: Session,
    current_user: models.User
):
    member = db.query(models.TeamMember).filter(
        models.TeamMember.id == member_id,
        models.TeamMember.owner_id == current_user.id
    ).first()

    if not member:
        raise HTTPException(
            status_code=404,
            detail="Team member not found"
        )

    return member


# Get team members
@router.get(
    "/team-members/",
    response_model=list[schemas.TeamMemberResponse]
)
def get_team_members(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    team_members = db.query(models.TeamMember).filter(
        models.TeamMember.owner_id == current_user.id
    ).order_by(
        models.TeamMember.id.desc()
    ).all()

    return team_members


# Create team member
@router.post(
    "/team-members/",
    response_model=schemas.TeamMemberResponse
)
def create_team_member(
    member: schemas.TeamMemberCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_member = models.TeamMember(
        full_name=member.full_name,
        email=member.email,
        role=member.role,
        department=member.department,
        access_level=member.access_level,
        status=member.status,
        owner_id=current_user.id
    )

    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    return new_member


# Get single team member by ID
@router.get(
    "/team-members/{member_id}",
    response_model=schemas.TeamMemberResponse
)
def get_team_member_by_id(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    member = ensure_team_member_owner(
        member_id=member_id,
        db=db,
        current_user=current_user
    )

    return member


# Update team member
@router.put("/team-members/{member_id}")
def update_team_member(
    member_id: int,
    member_update: schemas.TeamMemberUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    member = ensure_team_member_owner(
        member_id=member_id,
        db=db,
        current_user=current_user
    )

    update_data = member_update.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():
        setattr(member, key, value)

    db.commit()
    db.refresh(member)

    return {
        "message": "Team member updated successfully",
        "member": member
    }


# Delete team member
@router.delete("/team-members/{member_id}")
def delete_team_member(
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    member = ensure_team_member_owner(
        member_id=member_id,
        db=db,
        current_user=current_user
    )

    db.delete(member)
    db.commit()

    return {
        "message": "Team member deleted successfully"
    }


# Get team members assigned to a project
@router.get(
    "/projects/{project_id}/team",
    response_model=list[schemas.TeamMemberResponse]
)
def get_project_team_members(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = ensure_project_owner(
        project_id=project_id,
        db=db,
        current_user=current_user
    )

    return project.team_members


# Assign team member to project
@router.post(
    "/projects/{project_id}/team/{member_id}",
    response_model=schemas.MessageResponse
)
def assign_team_member_to_project(
    project_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = ensure_project_owner(
        project_id=project_id,
        db=db,
        current_user=current_user
    )

    member = ensure_team_member_owner(
        member_id=member_id,
        db=db,
        current_user=current_user
    )

    if member in project.team_members:
        raise HTTPException(
            status_code=400,
            detail="Team member is already assigned to this project"
        )

    project.team_members.append(member)

    db.commit()
    db.refresh(project)

    return {
        "message": "Team member assigned to project successfully"
    }


# Remove team member from project
@router.delete(
    "/projects/{project_id}/team/{member_id}",
    response_model=schemas.MessageResponse
)
def remove_team_member_from_project(
    project_id: int,
    member_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = ensure_project_owner(
        project_id=project_id,
        db=db,
        current_user=current_user
    )

    member = ensure_team_member_owner(
        member_id=member_id,
        db=db,
        current_user=current_user
    )

    if member not in project.team_members:
        raise HTTPException(
            status_code=400,
            detail="Team member is not assigned to this project"
        )

    project.team_members.remove(member)

    db.commit()
    db.refresh(project)

    return {
        "message": "Team member removed from project successfully"
    }
