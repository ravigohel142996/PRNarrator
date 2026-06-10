import { useMemo, useState } from 'react'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const CONFIGURED_MODEL = import.meta.env.VITE_GEMINI_MODEL?.trim() || 'gemini-3.1-flash-lite'
const modelCandidates = Array.from(
  new Set([CONFIGURED_MODEL, 'gemini-3.1-flash-lite', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].filter(Boolean)),
)

const outputCards = [
  { key: 'one_liner', label: 'One-liner', icon: '⚡', borderColor: '#58a6ff' },
  { key: 'stakeholder_summary', label: 'Stakeholder Summary', icon: '👔', borderColor: '#a371f7' },
  { key: 'sprint_bullets', label: 'Sprint Bullets', icon: '📋', borderColor: '#3fb950' },
  { key: 'risk_flags', label: 'Risk Flags', icon: '⚠️', borderColor: '#f85149' },
  { key: 'technical_summary', label: 'Technical Summary', icon: '🔧', borderColor: '#d29922' },
]

const SAMPLE_PR = {
  title: 'Fix authentication security vulnerabilities',
  description: 'Replace plaintext password with bcrypt hashing',
  diff: `diff --git a/auth/login.py b/auth/login.py
index e4f9a12..91b7c3d 100644
--- a/auth/login.py
+++ b/auth/login.py
@@ -1,16 +1,22 @@
-from db import get_user
+from db import get_user_by_email
+import bcrypt
 
-def login(email, password):
-    user = get_user(email)
+def login(email, raw_password):
+    user = get_user_by_email(email)
     if not user:
         return {"ok": False, "error": "User not found"}
 
-    # insecure: direct plaintext comparison
-    if user["password"] != password:
+    stored_hash = user.get("password_hash")
+    if not stored_hash:
+        return {"ok": False, "error": "Invalid credentials"}
+
+    password_matches = bcrypt.checkpw(
+        raw_password.encode("utf-8"),
+        stored_hash.encode("utf-8"),
+    )
+    if not password_matches:
         return {"ok": False, "error": "Invalid credentials"}
 
-    return {"ok": True, "user_id": user["id"]}
+    return {"ok": True, "user_id": user["id"], "auth_method": "bcrypt"}`,
}

const getGeminiErrorMessage = (rawError, status) => {
  if (!rawError) return `Gemini request failed with status ${status}.`
  try {
    const parsed = JSON.parse(rawError)
    return parsed?.error?.message || rawError
  } catch {
    return rawError
  }
}

function App() {
  const [prTitle, setPrTitle] = useState('')
  const [prDescription, setPrDescription] = useState('')
  const [prDiff, setPrDiff] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const canSubmit = useMemo(() => Boolean(prDiff.trim()) && !loading, [prDiff, loading])

  const narrate = async () => {
    setError('')
    setResult(null)

    if (!API_KEY) {
      setError('Missing VITE_GEMINI_API_KEY. Add it to your environment before narrating.')
      return
    }

    if (!prDiff.trim()) {
      setError('PR Diff is required.')
      return
    }

    const prompt = `You are PRNarrator. Analyze this PR and return ONLY valid JSON no markdown no backticks:
{one_liner: max 15 words for Slack, stakeholder_summary: 2-3 sentences for non-tech people, sprint_bullets: array of 3 strings, risk_flags: array of risks or empty array, technical_summary: 2-3 sentences for developers}
PR Title: ${prTitle || '[No title provided]'}
PR Description: ${prDescription || '[No description provided]'}
PR Diff: ${prDiff}`

    try {
      setLoading(true)
      let text = ''
      let lastError = ''

      for (const model of modelCandidates) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
          },
        )

        if (response.ok) {
          const data = await response.json()
          text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
          break
        }

        const rawError = await response.text().catch(() => '')
        const errorMessage = getGeminiErrorMessage(rawError, response.status)
        const modelUnavailable =
          response.status === 404 && /not found|not supported for generateContent/i.test(errorMessage)

        if (modelUnavailable) {
          lastError = `Model "${model}" is unavailable.`
          continue
        }

        throw new Error(errorMessage)
      }

      if (!text) {
        throw new Error(lastError || 'No compatible Gemini model is currently available for generateContent.')
      }

      setResult(JSON.parse(text))
    } catch (e) {
      setError(e.message || 'Failed to narrate PR.')
    } finally {
      setLoading(false)
    }
  }

  const loadSamplePR = () => {
    setPrTitle(SAMPLE_PR.title)
    setPrDescription(SAMPLE_PR.description)
    setPrDiff(SAMPLE_PR.diff)
    setError('')
  }

  const copyValue = async (value) => {
    const content = Array.isArray(value) ? value.join('\n') : String(value ?? '')
    await navigator.clipboard.writeText(content)
  }

  const renderValue = (key, value) => {
    if (key === 'sprint_bullets') {
      const items = Array.isArray(value) ? value : []
      return (
        <ul className="outputList">
          {items.length ? items.map((item, index) => <li key={`${item}-${index}`}>{item}</li>) : <li>—</li>}
        </ul>
      )
    }

    if (Array.isArray(value)) {
      return <p className="outputText">{value.length ? value.join(' • ') : '—'}</p>
    }

    return <p className="outputText">{value || '—'}</p>
  }

  const visibleCards = outputCards.filter(({ key }) => {
    if (key !== 'risk_flags') return true
    const risks = result?.risk_flags
    return Array.isArray(risks) ? risks.length > 0 : Boolean(risks)
  })

  return (
    <main className="pageShell">
      <style>{`
        .pageShell {
          min-height: 100vh;
          background: #0d1117;
          color: #c9d1d9;
          padding: 2.5rem 1rem 2rem;
          font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
        }

        .container {
          max-width: 900px;
          margin: 0 auto;
        }

        .gradientText {
          background: linear-gradient(135deg, #7c3aed, #2563eb);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .heroTitle {
          margin: 0;
          font-size: clamp(2.25rem, 6vw, 4rem);
          letter-spacing: -0.03em;
          font-weight: 800;
        }

        .heroSubtitle {
          margin: 0.8rem 0 1rem;
          color: #8b949e;
          font-size: 1.05rem;
          line-height: 1.5;
        }

        .badgeRow {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
        }

        .badge {
          border: 1px solid #30363d;
          background: #161b22;
          border-radius: 999px;
          padding: 0.42rem 0.8rem;
          font-size: 0.86rem;
          transition: all 0.25s ease;
        }

        .badge:hover {
          border-color: #7c3aed;
          transform: translateY(-1px);
        }

        .inputCard {
          margin-top: 1.3rem;
          background: rgba(22, 27, 34, 0.88);
          border: 1px solid #30363d;
          border-radius: 18px;
          padding: 1.25rem;
          backdrop-filter: blur(10px);
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }

        .inputCard:focus-within {
          border-color: #7c3aed;
          box-shadow: 0 0 0 1px rgba(124, 58, 237, 0.4), 0 0 24px rgba(37, 99, 235, 0.18);
        }

        .fieldLabel {
          display: block;
          margin: 0.8rem 0 0.45rem;
          font-size: 0.94rem;
          color: #f0f6fc;
          font-weight: 600;
        }

        .labelRow {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.75rem;
        }

        .fieldInput {
          width: 100%;
          border: 1px solid #30363d;
          border-radius: 12px;
          background: #0d1117;
          color: #c9d1d9;
          padding: 0.75rem 0.85rem;
          outline: none;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
        }

        .fieldInput:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 1px rgba(37, 99, 235, 0.4);
        }

        .diffInput {
          min-height: 280px;
          margin-top: 0.25rem;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace;
          line-height: 1.5;
          white-space: pre;
          background-image: linear-gradient(transparent 31px, rgba(255, 255, 255, 0.03) 32px);
          background-size: 100% 32px;
        }

        .ghostButton {
          width: auto;
          border: 1px solid #30363d;
          border-radius: 999px;
          background: transparent;
          color: #8b949e;
          padding: 0.38rem 0.74rem;
          cursor: pointer;
          transition: all 0.25s ease;
          font-weight: 500;
        }

        .ghostButton:hover {
          border-color: #7c3aed;
          color: #c9d1d9;
        }

        .analyzeButton {
          margin-top: 1rem;
          width: 100%;
          border: none;
          border-radius: 12px;
          padding: 0.82rem 1rem;
          font-weight: 700;
          background: linear-gradient(135deg, #2ea043, #238636);
          color: #ffffff;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .analyzeButton:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .analyzeButton:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 26px rgba(46, 160, 67, 0.3);
          animation: pulseGlow 1.2s ease-in-out infinite;
        }

        .errorText {
          margin-top: 0.8rem;
          color: #ff7b72;
        }

        .outputsGrid {
          margin-top: 1.2rem;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 0.85rem;
        }

        .outputCard {
          border: 1px solid #30363d;
          border-left: 4px solid;
          border-radius: 14px;
          background: #161b22;
          padding: 1rem;
          transition: all 0.25s ease;
        }

        .outputCard:hover {
          transform: translateY(-1px);
          border-color: #445068;
        }

        .cardHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.6rem;
        }

        .cardHeader h2 {
          margin: 0;
          font-size: 0.98rem;
          color: #f0f6fc;
        }

        .copyButton {
          width: auto;
          border: 1px solid #30363d;
          border-radius: 8px;
          background: #21262d;
          color: #c9d1d9;
          padding: 0.38rem 0.68rem;
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .copyButton:hover {
          border-color: #2563eb;
        }

        .outputText {
          margin: 0.65rem 0 0;
          line-height: 1.55;
          white-space: pre-wrap;
        }

        .outputList {
          margin: 0.65rem 0 0;
          padding-left: 1.2rem;
          line-height: 1.6;
        }

        .footer {
          margin-top: 1.5rem;
          border-top: 1px solid #30363d;
          padding-top: 1rem;
          display: grid;
          gap: 0.45rem;
          color: #8b949e;
          font-size: 0.92rem;
        }

        .footer p {
          margin: 0;
        }

        .footer a {
          color: #58a6ff;
          text-decoration: none;
          width: fit-content;
        }

        .footer a:hover {
          color: #79c0ff;
          text-decoration: underline;
        }

        .loadingOverlay {
          position: fixed;
          inset: 0;
          background: rgba(13, 17, 23, 0.76);
          display: grid;
          place-items: center;
          z-index: 999;
          backdrop-filter: blur(4px);
        }

        .spinnerRing {
          width: 76px;
          height: 76px;
          border-radius: 50%;
          border: 6px solid rgba(124, 58, 237, 0.2);
          border-top-color: #7c3aed;
          border-right-color: #2563eb;
          animation: spin 0.9s linear infinite;
        }

        .loadingText {
          margin-top: 0.9rem;
          text-align: center;
          color: #f0f6fc;
          font-weight: 600;
          font-size: 1.05rem;
        }

        .dots span {
          animation: blink 1.2s infinite;
        }

        .dots span:nth-child(2) { animation-delay: 0.2s; }
        .dots span:nth-child(3) { animation-delay: 0.4s; }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        @keyframes blink {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }

        @keyframes pulseGlow {
          0% { box-shadow: 0 10px 26px rgba(46, 160, 67, 0.2); }
          50% { box-shadow: 0 14px 34px rgba(46, 160, 67, 0.4); }
          100% { box-shadow: 0 10px 26px rgba(46, 160, 67, 0.2); }
        }
      `}</style>

      {loading && (
        <div className="loadingOverlay">
          <div>
            <div className="spinnerRing" />
            <p className="loadingText">
              Analyzing your PR
              <span className="dots">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </p>
          </div>
        </div>
      )}

      <div className="container">
        <header>
          <h1 className="gradientText heroTitle">PRNarrator</h1>
          <p className="heroSubtitle">Transform GitHub PR diffs into instant narratives for every audience</p>
          <div className="badgeRow">
            <span className="badge">⚡ Instant Analysis</span>
            <span className="badge">🎯 5 Output Formats</span>
            <span className="badge">🔒 Powered by Gemini AI</span>
          </div>
        </header>

        <section className="inputCard">
          <label className="fieldLabel" htmlFor="pr-title">
            🌿 PR Title
          </label>
          <input
            id="pr-title"
            value={prTitle}
            onChange={(e) => setPrTitle(e.target.value)}
            placeholder="e.g. Add OAuth callback handling"
            className="fieldInput"
          />

          <label className="fieldLabel" htmlFor="pr-description">
            PR Description
          </label>
          <textarea
            id="pr-description"
            value={prDescription}
            onChange={(e) => setPrDescription(e.target.value)}
            placeholder="Optional context from the PR description"
            rows={4}
            className="fieldInput"
          />

          <div className="labelRow">
            <label className="fieldLabel" htmlFor="pr-diff">
              PR Diff
            </label>
            <button type="button" onClick={loadSamplePR} className="ghostButton">
              Load Sample PR
            </button>
          </div>

          <textarea
            id="pr-diff"
            value={prDiff}
            onChange={(e) => setPrDiff(e.target.value)}
            placeholder="Paste git diff here..."
            rows={13}
            className="fieldInput diffInput"
          />

          <button type="button" onClick={narrate} disabled={!canSubmit} className="analyzeButton">
            ✨ Analyze PR
          </button>

          {error && <p className="errorText">{error}</p>}
        </section>

        {result && (
          <section className="outputsGrid">
            {visibleCards.map(({ key, label, icon, borderColor }) => (
              <article key={key} className="outputCard" style={{ borderLeftColor: borderColor }}>
                <div className="cardHeader">
                  <h2>
                    <span>{icon}</span> {label}
                  </h2>
                  <button type="button" onClick={() => copyValue(result[key])} className="copyButton">
                    Copy
                  </button>
                </div>
                {renderValue(key, result[key])}
              </article>
            ))}
          </section>
        )}

        <footer className="footer">
          <p>Built for Agents League Hackathon 2026 🏆</p>
          <a href="https://github.com/ravigohel142996/PRNarrator" target="_blank" rel="noreferrer">
            github.com/ravigohel142996/PRNarrator
          </a>
          <p>
            Built by{' '}
            <a href="https://www.linkedin.com/in/ravigohel142996/" target="_blank" rel="noreferrer">
              Ravi Gohel
            </a>
          </p>
        </footer>
      </div>
    </main>
  )
}

export default App
