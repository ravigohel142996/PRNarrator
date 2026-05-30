import json
import os
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from pydantic import BaseModel, Field

load_dotenv()
client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

app = FastAPI(title="PRNarrator API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NarrateRequest(BaseModel):
    diff: str = Field(..., min_length=1)
    pr_title: str = Field(default="")
    pr_description: str = Field(default="")


class NarrateResponse(BaseModel):
    one_liner: str
    stakeholder_summary: str
    sprint_bullets: List[str]
    risk_flags: List[str]
    technical_summary: str


def _build_prompt(payload: NarrateRequest) -> str:
    pr_title = payload.pr_title.strip() or "(not provided)"
    pr_description = payload.pr_description.strip() or "(not provided)"

    return (
        "You are PRNarrator. Convert the provided pull request data into concise, accurate summaries. "
        "Return STRICT JSON only with keys: one_liner (string), stakeholder_summary (string), "
        "sprint_bullets (array of short strings), risk_flags (array of short strings), "
        "technical_summary (string).\\n\\n"
        f"PR Title:\\n{pr_title}\\n\\n"
        f"PR Description:\\n{pr_description}\\n\\n"
        f"Diff:\\n{payload.diff}"
    )


@app.post("/narrate", response_model=NarrateResponse)
def narrate(payload: NarrateRequest) -> NarrateResponse:
    if not os.getenv("GROQ_API_KEY"):
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is not configured")

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Always produce accurate PR summaries and respond with JSON only. "
                        "Do not include markdown fences."
                    ),
                },
                {"role": "user", "content": _build_prompt(payload)},
            ],
        )
        raw_text = (response.choices[0].message.content or "").strip()
        parsed = json.loads(raw_text)

        return NarrateResponse(**parsed)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail="Invalid JSON returned by Groq model") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Narration failed: {str(exc)}") from exc
