# PRNarrator

PRNarrator is a frontend-only web app that transforms raw pull request diffs into concise narratives for engineering and non-engineering stakeholders using the Groq API directly from the browser.

## Project structure

```
PRNarrator/
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

- Frontend-only React + Vite app
- Direct Groq API integration from the browser
- Uses model `llama-3.3-70b-versatile`
- Generates:
  - `one_liner`
  - `stakeholder_summary`
  - `sprint_bullets`
  - `risk_flags`
  - `technical_summary`
- Copy buttons for each generated output section

## Frontend setup

1. Install dependencies:

```bash
cd frontend
npm install
```

2. Configure environment variable:

```bash
cp .env.example .env
```

Then update `.env`:

```bash
VITE_GROQ_API_KEY=your_groq_api_key_here
```

3. Start frontend dev server:

```bash
npm run dev
```

## Build

```bash
cd frontend
npm run build
```
