# PRNarrator

PRNarrator is a full-stack web app that transforms raw pull request diffs into concise narratives for engineering and non-engineering stakeholders.

## Project structure

```
PRNarrator/
├── backend/
│   ├── main.py
│   └── requirements.txt
└── frontend/
    ├── index.html
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── index.css
        └── main.jsx
```

## Features

- FastAPI backend with CORS support
- `POST /narrate` endpoint that accepts:
  - `diff` (required)
  - `pr_title` (optional)
  - `pr_description` (optional)
- Groq-powered output fields:
  - `one_liner`
  - `stakeholder_summary`
  - `sprint_bullets`
  - `risk_flags`
  - `technical_summary`
- React + Vite frontend using a GitHub-dark-style UI (`#0d1117`)
- Gemini-first narration with optional OpenRouter fallback when Gemini key/quota fails
- Copy buttons for each generated output section

## Backend setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Set environment variables:

```bash
export GROQ_API_KEY="your_api_key"
```

4. Start backend:

```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

## Frontend setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Configure frontend environment variables:

```bash
export VITE_GEMINI_API_KEY="your_api_key"
export VITE_GEMINI_MODEL="gemini-2.0-flash"
export VITE_OPENROUTER_API_KEY="your_api_key" # optional fallback
export VITE_OPENROUTER_MODEL="meta-llama/llama-3.1-8b-instruct:free"
```

3. Start frontend dev server:

```bash
npm run dev
```

## API contract

### `POST /narrate`

Request body:

```json
{
  "diff": "<git diff text>"
}
```

Response body:

```json
{
  "one_liner": "Adds OAuth callback handling and user session initialization.",
  "stakeholder_summary": "This update improves sign-in reliability by finalizing GitHub OAuth login.",
  "sprint_bullets": [
    "Added backend OAuth callback endpoint",
    "Persisted authenticated session",
    "Updated login flow tests"
  ],
  "risk_flags": [
    "OAuth provider outages can affect login availability"
  ],
  "technical_summary": "Introduces callback processing, token exchange, and guarded session creation."
}
```

## Notes

- The backend expects Groq to return strict JSON.
- If `GROQ_API_KEY` is missing, the API returns an error.
- CORS is enabled for local frontend/backend development.
