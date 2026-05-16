from database import SessionLocal, engine
import models
from auth_utils import get_password_hash
from sqlalchemy.orm import Session

def seed_rbac():
    db: Session = SessionLocal()
    
    users_to_seed = [
        {
            "full_name": "Manager User",
            "email": "manager@engisphere.com",
            "password": "Manager12345!",
            "role": "manager"
        },
        {
            "full_name": "Viewer User",
            "email": "viewer@engisphere.com",
            "password": "Viewer12345!",
            "role": "viewer"
        }
    ]
    
    print("Seeding RBAC demo users...")
    for user_data in users_to_seed:
        existing_user = db.query(models.User).filter(models.User.email == user_data["email"]).first()
        if not existing_user:
            new_user = models.User(
                full_name=user_data["full_name"],
                email=user_data["email"],
                hashed_password=get_password_hash(user_data["password"]),
                role=user_data["role"],
                is_active=True
            )
            db.add(new_user)
            print(f"Created user: {user_data['email']} with role: {user_data['role']}")
        else:
            print(f"User already exists: {user_data['email']}")
            
    db.commit()
    db.close()
    print("Seeding completed successfully.")

if __name__ == "__main__":
    seed_rbac()
