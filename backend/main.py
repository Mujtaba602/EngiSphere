from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

import models
from database import engine
from routers.auth import router as auth_router
from routers.projects import router as projects_router
from routers.team_members import router as team_members_router
from routers.tasks import router as tasks_router
from routers.chat import router as chat_router


load_dotenv()


models.Base.metadata.create_all(bind=engine)


app = FastAPI(
    title="EngiSphere API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)
app.include_router(projects_router)
app.include_router(team_members_router)
app.include_router(tasks_router)
app.include_router(chat_router)


@app.get("/")
def root():
    return {
        "message": "EngiSphere API is running successfully"
    }
