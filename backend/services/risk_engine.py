from datetime import date, timedelta


def normalize_task_status_value(status_value: str) -> str:
    value = (status_value or "Pending").strip().lower()

    if value == "completed":
        return "Completed"

    if value == "in progress":
        return "In Progress"

    return "Pending"


def calculate_project_risk(project, tasks, assigned_team_members):
    today = date.today()
    due_soon_limit = today + timedelta(days=3)

    total_tasks = len(tasks)

    completed_tasks = 0
    pending_tasks = 0
    in_progress_tasks = 0
    overdue_tasks = 0
    due_soon_tasks = 0
    unassigned_tasks = 0

    risk_score = 0
    factors = []
    recommendations = []

    project_status = (project.status or "Pending").strip().lower()

    for task in tasks:
        task_status = normalize_task_status_value(task.status)

        if task_status == "Completed":
            completed_tasks += 1
        elif task_status == "In Progress":
            in_progress_tasks += 1
        else:
            pending_tasks += 1

        if not task.assigned_member_id and task_status != "Completed":
            unassigned_tasks += 1

        if task.due_date and task_status != "Completed":
            if task.due_date < today:
                overdue_tasks += 1
            elif today <= task.due_date <= due_soon_limit:
                due_soon_tasks += 1

    team_members_count = len(assigned_team_members or [])

    if total_tasks > 0:
        completion_rate = round((completed_tasks / total_tasks) * 100)
    else:
        if project_status == "completed":
            completion_rate = 100
        elif project_status == "active":
            completion_rate = 65
        else:
            completion_rate = 25

    if total_tasks == 0:
        if project_status == "active":
            risk_score += 35
            factors.append("Project is Active but has no tasks defined.")
            recommendations.append(
                "Create execution tasks immediately to track progress, responsibilities, and delivery risk."
            )

        elif project_status == "completed":
            risk_score += 20
            factors.append("Project is Completed but has no documented tasks.")
            recommendations.append(
                "Add closeout or historical tasks to improve project traceability and audit readiness."
            )

        else:
            risk_score += 15
            factors.append("Project has no tasks defined yet.")
            recommendations.append(
                "Create project tasks before starting execution."
            )

    if team_members_count == 0:
        risk_score += 15
        factors.append("No team members are assigned to this project.")
        recommendations.append(
            "Assign at least one responsible team member to the project."
        )

    elif team_members_count == 1 and total_tasks >= 4:
        risk_score += 8
        factors.append(
            "Only one team member is assigned while the project has multiple tasks."
        )
        recommendations.append(
            "Consider adding more team members to distribute workload."
        )

    if overdue_tasks > 0:
        risk_score += min(overdue_tasks * 15, 45)
        factors.append(f"{overdue_tasks} task(s) are overdue.")
        recommendations.append(
            "Prioritize overdue tasks and update the execution schedule."
        )

    if due_soon_tasks > 0:
        risk_score += min(due_soon_tasks * 8, 24)
        factors.append(f"{due_soon_tasks} task(s) are due within the next 3 days.")
        recommendations.append(
            "Review near-deadline tasks and confirm readiness with assigned engineers."
        )

    if unassigned_tasks > 0:
        risk_score += min(unassigned_tasks * 7, 35)
        factors.append(
            f"{unassigned_tasks} active task(s) are not assigned to any team member."
        )
        recommendations.append(
            "Assign all active tasks to responsible team members."
        )

    if pending_tasks > 0:
        risk_score += min(pending_tasks * 4, 20)
        factors.append(f"{pending_tasks} task(s) are still pending.")

    if in_progress_tasks > 0:
        risk_score += min(in_progress_tasks * 2, 10)

    if project_status == "pending":
        risk_score += 10
        factors.append("Project status is still Pending.")
        recommendations.append(
            "Move the project to Active when execution starts."
        )

    if project_status == "completed" and (pending_tasks > 0 or in_progress_tasks > 0):
        risk_score += 25
        factors.append(
            "Project is marked as Completed while some tasks are not completed."
        )
        recommendations.append(
            "Complete or close all remaining tasks before marking the project as completed."
        )

    if total_tasks > 0 and completed_tasks == 0:
        risk_score += 8
        factors.append("No tasks have been completed yet.")
        recommendations.append(
            "Complete initial tasks to reduce execution uncertainty."
        )

    risk_score = min(risk_score, 100)

    if risk_score <= 30:
        risk_level = "Low"
        risk_color = "#10b981"
    elif risk_score <= 65:
        risk_level = "Medium"
        risk_color = "#f59e0b"
    else:
        risk_level = "High"
        risk_color = "#ef4444"

    if not factors:
        factors.append("No significant risk factors detected.")

    if not recommendations:
        recommendations.append(
            "Continue monitoring project tasks and team performance."
        )

    if total_tasks > 0:
        summary = (
            f"Project risk is {risk_level.lower()} with a score of {risk_score}%. "
            f"Completion rate is {completion_rate}% based on {total_tasks} task(s)."
        )
    else:
        summary = (
            f"Project risk is {risk_level.lower()} with a score of {risk_score}%. "
            f"No tasks are currently defined, so progress is estimated from the project status."
        )

    return {
        "risk_score": risk_score,
        "risk_level": risk_level,
        "risk_color": risk_color,
        "summary": summary,
        "factors": factors,
        "recommendations": recommendations,
        "metrics": {
            "total_tasks": total_tasks,
            "completed_tasks": completed_tasks,
            "pending_tasks": pending_tasks,
            "in_progress_tasks": in_progress_tasks,
            "overdue_tasks": overdue_tasks,
            "due_soon_tasks": due_soon_tasks,
            "unassigned_tasks": unassigned_tasks,
            "team_members": team_members_count,
            "completion_rate": completion_rate,
        },
    }
