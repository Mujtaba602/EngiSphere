from sqlalchemy import Table, Column, Integer, String, Text, Date, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from database import Base


# جدول وسيط لربط المشاريع بأعضاء الفريق
# Project Many-to-Many TeamMember
project_team_members = Table(
    "project_team_members",
    Base.metadata,
    Column(
        "project_id",
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        primary_key=True
    ),
    Column(
        "team_member_id",
        Integer,
        ForeignKey("team_members.id", ondelete="CASCADE"),
        primary_key=True
    )
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    projects = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete-orphan"
    )

    team_members = relationship(
        "TeamMember",
        back_populates="owner",
        cascade="all, delete-orphan"
    )


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="Pending", nullable=False)

    location = Column(String, default="Unknown")
    project_type = Column(String, default="General")
    risk_level = Column(String, default="Low")
    weather_data = Column(String, default="25°C - Clear")

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="projects"
    )

    # أعضاء الفريق المرتبطين بهذا المشروع
    team_members = relationship(
        "TeamMember",
        secondary=project_team_members,
        back_populates="projects"
    )

    # مهام المشروع
    tasks = relationship(
        "ProjectTask",
        back_populates="project",
        cascade="all, delete-orphan"
    )


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)

    full_name = Column(String, nullable=False)
    email = Column(String, nullable=False, index=True)

    role = Column(String, default="Engineer", nullable=False)
    department = Column(String, default="General", nullable=False)

    access_level = Column(String, default="Viewer", nullable=False)
    status = Column(String, default="Active", nullable=False)

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    owner_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    owner = relationship(
        "User",
        back_populates="team_members"
    )

    # المشاريع المرتبط بها هذا العضو
    projects = relationship(
        "Project",
        secondary=project_team_members,
        back_populates="team_members"
    )

    # المهام المسندة لهذا العضو
    tasks = relationship(
        "ProjectTask",
        back_populates="assigned_member"
    )


class ProjectTask(Base):
    __tablename__ = "project_tasks"

    id = Column(Integer, primary_key=True, index=True)

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    status = Column(String, default="Pending", nullable=False)
    due_date = Column(Date, nullable=True)

    project_id = Column(
        Integer,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False
    )

    assigned_member_id = Column(
        Integer,
        ForeignKey("team_members.id", ondelete="SET NULL"),
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc)
    )

    updated_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    project = relationship(
        "Project",
        back_populates="tasks"
    )

    assigned_member = relationship(
        "TeamMember",
        back_populates="tasks"
    )