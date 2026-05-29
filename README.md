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
  - `diff`
  - `pr_title`
  - `pr_description`
- Claude-powered output fields:
  - `one_liner`
  - `stakeholder_summary`
  - `sprint_bullets`
  - `risk_flags`
  - `technical_summary`
- React + Vite frontend using a GitHub-dark-style UI (`#0d1117`)
- Copy buttons for each generated output section

## Backend setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r backend/requirements.txt
```

3. Set environment variables:

```bash
export ANTHROPIC_API_KEY="your_api_key"
# Optional
export ANTHROPIC_MODEL="claude-3-5-sonnet-latest"
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

2. (Optional) Override backend URL:

```bash
export VITE_API_BASE="http://localhost:8000"
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
  "diff": "<git diff text>",
  "pr_title": "Add GitHub OAuth callback support",
  "pr_description": "Implements callback route and session handling"
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

- The backend expects Claude to return strict JSON.
- If `ANTHROPIC_API_KEY` is missing, the API returns an error.
- CORS is enabled for local frontend/backend development.
