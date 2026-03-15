from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import OAuth2PasswordBearer
from typing import List
import models, schemas
from database import SessionLocal, engine

# Database Init
models.Base.metadata.create_all(bind=engine)

# Security Constants
SECRET_KEY = "engisphere_2026_secure_key"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helpers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# Dependency to protect routes
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Invalid Session")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
    
    user = db.query(models.User).filter(models.User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Endpoints
@app.post("/users/")
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    hashed_pw = get_password_hash(user.password)
    new_user = models.User(
        full_name=user.full_name, email=user.email,
        user_type=user.user_type, password=hashed_pw
    )
    db.add(new_user)
    db.commit()
    return {"message": "Engineer registered"}

@app.post("/login")
def login(user_credentials: schemas.UserCreate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == user_credentials.email).first()
    if not user or not verify_password(user_credentials.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "full_name": user.full_name,
        "user_id": user.id
    }

# PROTECTED: Only logged in engineers can see projects
@app.get("/projects/", response_model=List[schemas.Project])
def get_all_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Project).all()

@app.post("/projects/")
def create_project(project: schemas.ProjectCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    new_project = models.Project(**project.dict())
    db.add(new_project)
    db.commit()
    return new_project
def get_password_hash(password: str):
    return pwd_context.hash(password[:72]) 

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password[:72], hashed_password)
# Function to get all users (This will fix the 405 error)
@app.get("/users/", response_model=List[schemas.User])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()