import { useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const outputLabels = {
  one_liner: 'One-liner',
  stakeholder_summary: 'Stakeholder Summary',
  sprint_bullets: 'Sprint Bullets',
  risk_flags: 'Risk Flags',
  technical_summary: 'Technical Summary',
}

function App() {
  const [prTitle, setPrTitle] = useState('')
  const [prDescription, setPrDescription] = useState('')
  const [diff, setDiff] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const narrate = async () => {
    setError('')
    setResult(null)

    if (!prTitle.trim() || !diff.trim()) {
      setError('PR title and diff are required.')
      return
    }

    try {
      setLoading(true)
      const response = await fetch(`${API_BASE}/narrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pr_title: prTitle,
          pr_description: prDescription,
          diff,
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.detail || 'Narration failed')
      }

      const data = await response.json()
      setResult(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const copyValue = async (value) => {
    const output = Array.isArray(value) ? value.join('\n') : value
    await navigator.clipboard.writeText(output || '')
  }

  const renderValue = (value) => {
    if (Array.isArray(value)) {
      return (
        <ul>
          {value.map((item, idx) => (
            <li key={`${item}-${idx}`}>{item}</li>
          ))}
        </ul>
      )
    }
    return <p>{value}</p>
  }

  return (
    <main className="app">
      <h1>PRNarrator</h1>
      <p className="subtitle">Turn raw pull request changes into stakeholder-ready narratives.</p>

      <div className="panel">
        <label>PR Title</label>
        <input
          value={prTitle}
          onChange={(e) => setPrTitle(e.target.value)}
          placeholder="e.g. Add OAuth callback handling"
        />

        <label>PR Description</label>
        <textarea
          value={prDescription}
          onChange={(e) => setPrDescription(e.target.value)}
          placeholder="Optional context from the PR description"
          rows={4}
        />

        <label>PR Diff</label>
        <textarea
          value={diff}
          onChange={(e) => setDiff(e.target.value)}
          placeholder="Paste git diff here..."
          rows={12}
        />

        <button onClick={narrate} disabled={loading}>
          {loading ? 'Narrating...' : 'Narrate'}
        </button>

        {error && <p className="error">{error}</p>}
      </div>

      {result && (
        <section className="outputs">
          {Object.keys(outputLabels).map((key) => (
            <article key={key} className="output-card">
              <div className="output-header">
                <h2>{outputLabels[key]}</h2>
                <button onClick={() => copyValue(result[key])}>Copy</button>
              </div>
              <div className="output-body">{renderValue(result[key])}</div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}

export default App
