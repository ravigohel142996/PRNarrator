import { useState } from 'react'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const SYSTEM_PROMPT = `You are PRNarrator. Analyze the PR diff and return ONLY valid JSON with no markdown no backticks:
{
  one_liner: one sentence max 15 words for Slack,
  stakeholder_summary: 2-3 sentences for non-technical people,
  sprint_bullets: array of 3 bullet strings,
  risk_flags: array of risk strings or empty array,
  technical_summary: 2-3 sentences for developers
}`

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
      const apiKey = import.meta.env.VITE_GROQ_API_KEY
      if (!apiKey) {
        throw new Error('Missing VITE_GROQ_API_KEY')
      }

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `PR Title: ${prTitle}\nPR Description: ${prDescription || 'N/A'}\nPR Diff:\n${diff}`,
            },
          ],
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error?.message || 'Narration failed')
      }

      const data = await response.json()
      const content = data?.choices?.[0]?.message?.content
      if (!content) {
        throw new Error('Invalid response from Groq API')
      }

      const parsed = JSON.parse(content)
      setResult({
        one_liner: parsed.one_liner || '',
        stakeholder_summary: parsed.stakeholder_summary || '',
        sprint_bullets: Array.isArray(parsed.sprint_bullets) ? parsed.sprint_bullets : [],
        risk_flags: Array.isArray(parsed.risk_flags) ? parsed.risk_flags : [],
        technical_summary: parsed.technical_summary || '',
      })
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
