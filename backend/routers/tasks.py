from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth_utils import get_current_user


router = APIRouter(
    tags=["Project Tasks"]
)


def serialize_project_task(task: models.ProjectTask):
    assigned_member = task.assigned_member

    return {
        "id": task.id,
        "title": task.title,
        "description": task.description,
        "status": task.status,
        "due_date": task.due_date,
        "project_id": task.project_id,
        "assigned_member_id": task.assigned_member_id,
        "assigned_member_name": assigned_member.full_name if assigned_member else None,
        "assigned_member_email": assigned_member.email if assigned_member else None,
        "assigned_member_role": assigned_member.role if assigned_member else None,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
    }


def validate_task_status(status_value: str):
    allowed_statuses = [
        "Pending",
        "In Progress",
        "Completed"
    ]

    if status_value not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail="Invalid task status. Allowed values: Pending, In Progress, Completed"
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


def ensure_member_assigned_to_project(
    project: models.Project,
    member_id: int
):
    if member_id is None:
        return

    assigned_ids = [
        member.id for member in project.team_members
    ]

    if member_id not in assigned_ids:
        raise HTTPException(
            status_code=400,
            detail="This team member is not assigned to this project"
        )


@router.get(
    "/projects/{project_id}/tasks",
    response_model=list[schemas.ProjectTaskResponse]
)
def get_project_tasks(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = ensure_project_owner(
        project_id=project_id,
        db=db,
        current_user=current_user
    )

    tasks = db.query(models.ProjectTask).filter(
        models.ProjectTask.project_id == project.id
    ).order_by(
        models.ProjectTask.created_at.desc()
    ).all()

    return [
        serialize_project_task(task)
        for task in tasks
    ]


@router.post(
    "/projects/{project_id}/tasks",
    response_model=schemas.ProjectTaskResponse
)
def create_project_task(
    project_id: int,
    task_data: schemas.ProjectTaskCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = ensure_project_owner(
        project_id=project_id,
        db=db,
        current_user=current_user
    )

    status_value = task_data.status or "Pending"

    validate_task_status(status_value)

    if task_data.assigned_member_id:
        ensure_member_assigned_to_project(
            project=project,
            member_id=task_data.assigned_member_id
        )

    task = models.ProjectTask(
        title=task_data.title,
        description=task_data.description,
        status=status_value,
        due_date=task_data.due_date,
        project_id=project.id,
        assigned_member_id=task_data.assigned_member_id
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return serialize_project_task(task)


@router.put(
    "/tasks/{task_id}",
    response_model=schemas.ProjectTaskResponse
)
def update_project_task(
    task_id: int,
    task_data: schemas.ProjectTaskUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.ProjectTask).join(
        models.Project
    ).filter(
        models.ProjectTask.id == task_id,
        models.Project.owner_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    update_data = task_data.model_dump(
        exclude_unset=True
    )

    if "status" in update_data and update_data["status"] is not None:
        validate_task_status(update_data["status"])

    if "assigned_member_id" in update_data:
        if update_data["assigned_member_id"] is not None:
            ensure_member_assigned_to_project(
                project=task.project,
                member_id=update_data["assigned_member_id"]
            )

    for field, value in update_data.items():
        setattr(task, field, value)

    db.commit()
    db.refresh(task)

    return serialize_project_task(task)


@router.delete(
    "/tasks/{task_id}",
    response_model=schemas.MessageResponse
)
def delete_project_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    task = db.query(models.ProjectTask).join(
        models.Project
    ).filter(
        models.ProjectTask.id == task_id,
        models.Project.owner_id == current_user.id
    ).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    db.delete(task)
    db.commit()

    return {
        "message": "Task deleted successfully"
    }
