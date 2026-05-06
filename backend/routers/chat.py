import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from dotenv import load_dotenv
from google import genai

import models
from database import get_db
from auth_utils import get_current_user


load_dotenv()


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in environment variables")


client = genai.Client(
    api_key=GEMINI_API_KEY,
    http_options={"api_version": "v1"}
)


router = APIRouter(
    tags=["EngiBot"]
)


class ChatMessage(BaseModel):
    message: str


@router.post("/api/chat")
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

        return {
            "reply": response.text
        }

    except Exception as e:
        print(f"Gemini Error Details: {str(e)}")

        raise HTTPException(
            status_code=500,
            detail="AI service error"
        )
