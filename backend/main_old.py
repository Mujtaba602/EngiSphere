from fastapi import FastAPI, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
import models, schemas
from database import engine, get_db
from pydantic import BaseModel
import os

# مكتبة جوجل الرسمية
from google import genai

# إنشاء الجداول
models.Base.metadata.create_all(bind=engine)
app = FastAPI()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# إعدادات الحماية
SECRET_KEY = "engisphere_super_secret_key_12345" 
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 600
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# --- 🌟 تحديث مفتاح Gemini الجديد 🌟 ---
GEMINI_API_KEY = "AIzaSyByLq4rUxGC8_IO2H5pEH-zbSrLVLnJpRE"
os.environ["GEMINI_API_KEY"] = GEMINI_API_KEY
client = genai.Client(api_key=GEMINI_API_KEY)

class ChatMessage(BaseModel):
    message: str

def get_password_hash(password): return pwd_context.hash(password)
def verify_password(plain, hashed): return pwd_context.verify(plain, hashed)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None: raise HTTPException(status_code=401)
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user is None: raise HTTPException(status_code=401)
        return user
    except: raise HTTPException(status_code=401)

@app.post("/register/")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = get_password_hash(user.password)
    new_user = models.User(full_name=user.full_name, email=user.email, hashed_password=hashed_pwd)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    token = create_access_token(data={"sub": str(new_user.id)})
    return {"access_token": token, "token_type": "bearer"}

@app.post("/login") 
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_access_token(data={"sub": str(user.id)}), "token_type": "bearer"}

@app.get("/users/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {"full_name": current_user.full_name, "email": current_user.email}

@app.get("/projects/")
def read_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Project).filter(models.Project.owner_id == current_user.id).all()

@app.post("/projects/")
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_project = models.Project(
        title=project.title,
        location=project.location,
        status=project.status,
        owner_id=current_user.id
    )
    db.add(new_project)
    db.commit()
    db.refresh(new_project)
    return new_project

@app.get("/projects/stats")
def get_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    q = db.query(models.Project).filter(models.Project.owner_id == current_user.id)
    active = q.filter(models.Project.status == "Active").count()
    pending = q.filter(models.Project.status == "Pending").count()
    completed = q.filter(models.Project.status == "Completed").count()
    return {"active": active, "pending": pending, "completed": completed, "total": q.count()}

# --- 🚀 العودة للذكاء الاصطناعي المضمون (Gemini 2.0 Flash) 🚀 ---
@app.post("/api/chat")
async def chat_endpoint(chat: ChatMessage):
    try:
        prompt_context = f"You are EngiBot, a professional engineering assistant. Answer this: {chat.message}"
        
        # استخدمنا gemini-1.5-flash لضمان السرعة والاستقرار
        response = await client.aio.models.generate_content(
            model='gemini-1.5-flash',
            contents=prompt_context
        )
        
        return {"reply": response.text}

    except Exception as e:
        print(f"Gemini Error Details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
# --- دالة تحديث الباسورد ---
class PasswordUpdate(BaseModel):
    old_password: str
    new_password: str

@app.put("/users/update-password")
async def update_user_password(
    data: PasswordUpdate, 
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_user) 
):
    if not verify_password(data.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect old password")
    
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    
    return {"message": "Password updated successfully"}