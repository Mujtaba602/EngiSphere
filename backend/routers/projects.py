from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
import schemas
from database import get_db
from auth_utils import get_current_user
from services.risk_engine import calculate_project_risk


router = APIRouter(
    prefix="/projects",
    tags=["Projects"]
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


# Get user projects
@router.get("/", response_model=list[schemas.ProjectResponse])
def read_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    projects = db.query(models.Project).filter(
        models.Project.owner_id == current_user.id
    ).all()

    return projects


# Create new project
@router.post("/", response_model=schemas.ProjectResponse)
def create_project(
    project: schemas.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    new_project = models.Project(
        title=project.title,
        description=project.description,
        location=project.location,
        status=project.status,
        project_type=project.project_type,
        owner_id=current_user.id
    )

    db.add(new_project)
    db.commit()
    db.refresh(new_project)

    return new_project


# Project statistics
@router.get("/stats", response_model=schemas.ProjectStats)
def get_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    active = db.query(models.Project).filter(
        models.Project.owner_id == current_user.id,
        models.Project.status == "Active"
    ).count()

    pending = db.query(models.Project).filter(
        models.Project.owner_id == current_user.id,
        models.Project.status == "Pending"
    ).count()

    completed = db.query(models.Project).filter(
        models.Project.owner_id == current_user.id,
        models.Project.status == "Completed"
    ).count()

    total = db.query(models.Project).filter(
        models.Project.owner_id == current_user.id
    ).count()

    return {
        "active": active,
        "pending": pending,
        "completed": completed,
        "total": total
    }


# Portfolio risk summary
@router.get("/risk-summary")
def get_projects_risk_summary(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    projects = db.query(models.Project).filter(
        models.Project.owner_id == current_user.id
    ).all()

    total_projects = len(projects)

    high_risk = 0
    medium_risk = 0
    low_risk = 0
    total_risk_score = 0

    top_risky_projects = []
    critical_actions = []

    for project in projects:
        tasks = db.query(models.ProjectTask).filter(
            models.ProjectTask.project_id == project.id
        ).all()

        assigned_team_members = list(project.team_members or [])

        risk_data = calculate_project_risk(
            project=project,
            tasks=tasks,
            assigned_team_members=assigned_team_members
        )

        risk_score = risk_data["risk_score"]
        risk_level = risk_data["risk_level"]

        total_risk_score += risk_score

        if risk_level == "High":
            high_risk += 1
        elif risk_level == "Medium":
            medium_risk += 1
        else:
            low_risk += 1

        main_factor = (
            risk_data["factors"][0]
            if risk_data.get("factors")
            else "No major risk factor."
        )

        top_risky_projects.append({
            "project_id": project.id,
            "title": project.title,
            "status": project.status,
            "risk_score": risk_score,
            "risk_level": risk_level,
            "risk_color": risk_data["risk_color"],
            "main_factor": main_factor,
            "completion_rate": risk_data["metrics"]["completion_rate"],
            "total_tasks": risk_data["metrics"]["total_tasks"],
            "overdue_tasks": risk_data["metrics"]["overdue_tasks"],
            "unassigned_tasks": risk_data["metrics"]["unassigned_tasks"],
            "team_members": risk_data["metrics"]["team_members"]
        })

        if risk_level == "High":
            critical_actions.append({
                "project_id": project.id,
                "title": project.title,
                "action": (
                    risk_data["recommendations"][0]
                    if risk_data.get("recommendations")
                    else "Review project risk immediately."
                ),
                "risk_score": risk_score
            })

    top_risky_projects = sorted(
        top_risky_projects,
        key=lambda item: item["risk_score"],
        reverse=True
    )[:5]

    average_risk_score = (
        round(total_risk_score / total_projects)
        if total_projects > 0
        else 0
    )

    if average_risk_score <= 30:
        portfolio_risk_level = "Low"
        portfolio_risk_color = "#10b981"
    elif average_risk_score <= 65:
        portfolio_risk_level = "Medium"
        portfolio_risk_color = "#f59e0b"
    else:
        portfolio_risk_level = "High"
        portfolio_risk_color = "#ef4444"

    return {
        "total_projects": total_projects,
        "average_risk_score": average_risk_score,
        "portfolio_risk_level": portfolio_risk_level,
        "portfolio_risk_color": portfolio_risk_color,
        "high_risk": high_risk,
        "medium_risk": medium_risk,
        "low_risk": low_risk,
        "critical_actions_count": len(critical_actions),
        "critical_actions": critical_actions[:5],
        "top_risky_projects": top_risky_projects
    }


# Project Risk Assessment Endpoint
@router.get(
    "/{project_id}/risk-assessment",
    response_model=schemas.ProjectRiskAssessmentResponse
)
def get_project_risk_assessment(
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
    ).all()

    assigned_team_members = list(project.team_members or [])

    risk_data = calculate_project_risk(
        project=project,
        tasks=tasks,
        assigned_team_members=assigned_team_members
    )

    return {
        "project_id": project.id,
        **risk_data
    }


# Get single project by ID
@router.get("/{project_id}", response_model=schemas.ProjectResponse)
def get_project_by_id(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = ensure_project_owner(
        project_id=project_id,
        db=db,
        current_user=current_user
    )

    return project


# Update project by ID
@router.put("/{project_id}")
def update_project(
    project_id: int,
    project_update: schemas.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = ensure_project_owner(
        project_id=project_id,
        db=db,
        current_user=current_user
    )

    update_data = project_update.model_dump(
        exclude_unset=True
    )

    for key, value in update_data.items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)

    return {
        "message": "Project updated successfully",
        "project": project
    }


# Delete project by ID
@router.delete("/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = ensure_project_owner(
        project_id=project_id,
        db=db,
        current_user=current_user
    )

    db.delete(project)
    db.commit()

    return {
        "message": "Project deleted successfully"
    }
