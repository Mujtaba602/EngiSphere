from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from . import models, schemas
from .database import engine, get_db

# --- 1. استدعاء مكتبات الذكاء الاصطناعي ---
import google.generativeai as genai
from pydantic import BaseModel

models.Base.metadata.create_all(bind=engine)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "your-very-secret-and-long-key-for-engisphere"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# ==========================================
# إعدادات الذكاء الاصطناعي (AI Configuration)
# ==========================================
# الرجاء استبدال "YOUR_API_KEY" بمفتاحك الحقيقي من Google AI Studio
GEMINI_API_KEY = "YOUR_API_KEY" 
genai.configure(api_key=GEMINI_API_KEY)
ai_model = genai.GenerativeModel('gemini-1.5-flash')

class ChatMessage(BaseModel):
    message: str

# ==========================================
# دوال التشفير والحماية الأساسية
# ==========================================

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

# ==========================================
# روابط تسجيل الدخول والمستخدمين
# ==========================================

@app.post("/register/", response_model=schemas.UserResponse)
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    safe_password = user.password[:72]
    hashed_password = get_password_hash(safe_password)
    
    new_user = models.User(full_name=user.full_name, email=user.email, hashed_password=hashed_password)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/login/")
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer", "user_name": user.full_name}

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user

# ==========================================
# روابط إدارة المشاريع
# ==========================================

@app.post("/projects/", response_model=schemas.ProjectResponse)
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_project = models.Project(**project.dict(), owner_id=current_user.id)
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@app.get("/projects/")
def read_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Project).filter(models.Project.owner_id == current_user.id).all()

@app.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    db_project = db.query(models.Project).filter(models.Project.id == project_id, models.Project.owner_id == current_user.id).first()
    if not db_project:
        raise HTTPException(status_code=404, detail="Project not found or unauthorized")
    db.delete(db_project)
    db.commit()
    return {"message": "Project deleted successfully"}

@app.get("/projects/stats")
def get_project_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    active = db.query(models.Project).filter(models.Project.owner_id == current_user.id, models.Project.status == "Active").count()
    pending = db.query(models.Project).filter(models.Project.owner_id == current_user.id, models.Project.status == "Pending").count()
    completed = db.query(models.Project).filter(models.Project.owner_id == current_user.id, models.Project.status == "Completed").count()
    
    return {
        "active": active,
        "pending": pending,
        "completed": completed,
        "total": active + pending + completed
    }

# ==========================================
# 🤖 رابط الذكاء الاصطناعي (AI Chat API)
# ==========================================

@app.post("/api/chat")
def chat_with_engibot(chat: ChatMessage):
    try:
        # إعطاء الذكاء الاصطناعي شخصية (Prompt Engineering)
        system_prompt = f"""
        You are EngiBot, an expert engineering and construction AI assistant inside the 'EngiSphere' platform. 
        Your tone is professional, helpful, concise, and related to engineering.
        Do not use bold markdown tags like ** text ** in your response, keep it clean.
        Answer this user's query: {chat.message}
        """
        
        response = ai_model.generate_content(system_prompt)
        return {"reply": response.text}
    
    except Exception as e:
        print(f"AI Error: {e}")
        return {"reply": "Sorry, I am currently undergoing maintenance. Please check the backend connection or API Key."}