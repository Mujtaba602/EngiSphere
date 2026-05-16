from fastapi import Depends, HTTPException, status

import models
from auth_utils import get_current_user


def normalize_role(role):
    return (role or "viewer").strip().lower()


def require_roles(*allowed_roles):
    allowed = {normalize_role(role) for role in allowed_roles}

    def dependency(
        current_user: models.User = Depends(get_current_user)
    ):
        user_role = normalize_role(getattr(current_user, "role", "viewer"))

        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "message": "Insufficient permissions",
                    "required_roles": sorted(allowed),
                    "current_role": user_role,
                },
            )

        return current_user

    return dependency


def require_admin(
    current_user: models.User = Depends(get_current_user)
):
    user_role = normalize_role(getattr(current_user, "role", "viewer"))

    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "message": "Admin privileges required",
                "current_role": user_role,
            },
        )

    return current_user
