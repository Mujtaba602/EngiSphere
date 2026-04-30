from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import os

import models
import schemas
from database import engine, get_db
from google import genai

load_dotenv()

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="EngiSphere API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not SECRET_KEY:
    raise ValueError("SECRET_KEY is not set in environment variables")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in environment variables")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")
client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options={"api_version": "v1"}
)


class ChatMessage(BaseModel):
    message: str


class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception

    return user


@app.post("/register/")
def register_user(user_data: schemas.UserCreate, db: Session = Depends(get_db)):
    # 1. التأكد إن الإيميل مش متسجل قبل كدة
    db_user = db.query(models.User).filter(models.User.email == user_data.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # 2. إنشاء الحساب
    hashed_password = get_password_hash(user_data.password)
    new_user = models.User(full_name=user_data.full_name, email=user_data.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 3. 🚀 إصدار التوكن فوراً عشان يدخل الهوم بدون ما يعمل تسجيل دخول تاني
    access_token = create_access_token(data={"sub": str(new_user.id)})
    
    # الرد لازم يكون فيه الكلمة دي "access_token"
    return {"message": "Account created successfully", "access_token": access_token}

@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "access_token": create_access_token(data={"sub": str(user.id)}),
        "token_type": "bearer"
    }


@app.get("/users/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user


@app.get("/projects/", response_model=list[schemas.ProjectResponse])
def read_projects(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    return db.query(models.Project).filter(
        models.Project.owner_id == current_user.id
    ).all()


@app.post("/projects/", response_model=schemas.ProjectResponse)
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


@app.get("/projects/stats", response_model=schemas.ProjectStats)
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


@app.post("/api/chat")
async def chat_endpoint(
    chat: ChatMessage,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    try:
        user_projects = db.query(models.Project).filter(
            models.Project.owner_id == current_user.id
        ).order_by(
            models.Project.id.desc()
        ).limit(3).all()

        projects_context = "\n".join([
            f"- Title: {p.title} | Status: {p.status} | Type: {p.project_type} | Location: {p.location}"
            for p in user_projects
        ]) or "No user projects found."

        prompt_context = f"""
You are EngiBot, an AI engineering assistant inside the EngiSphere platform.

Your role:
- Answer as a professional engineering and software project assistant.
- Be practical, structured, and concise.
- Prefer clear sections and bullet points when useful.
- If the question is about risks, architecture, planning, feasibility, or documentation, answer in an academic engineering style.
- If the request is unclear, ask one short clarifying question.
- Do not invent technical standards, costs, or facts.

Response style when useful:
1. Brief analysis
2. Key points or risks
3. Recommendation
4. Next action

Current user: {current_user.full_name}

Recent user projects:
{projects_context}

User question:
{chat.message}
"""

        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt_context
        )

        return {"reply": response.text}

    except Exception as e:
        print(f"Gemini Error Details: {str(e)}")
        raise HTTPException(status_code=500, detail="AI service error")


@app.put("/users/update-password")
async def update_user_password(
    data: PasswordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password")

    if len(data.new_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="New password must be at least 8 characters"
        )

    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()

    return {"message": "Password updated successfully"}