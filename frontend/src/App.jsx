import { useMemo, useState } from 'react'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const CONFIGURED_MODEL = import.meta.env.VITE_GEMINI_MODEL?.trim() || 'gemini-2.0-flash'
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL?.trim() || 'meta-llama/llama-3.1-8b-instruct:free'
const modelCandidates = Array.from(
  new Set([CONFIGURED_MODEL, 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'].filter(Boolean)),
)
const outputFields = [
  ['one_liner', 'One-liner'],
  ['stakeholder_summary', 'Stakeholder Summary'],
  ['sprint_bullets', 'Sprint Bullets'],
  ['risk_flags', 'Risk Flags'],
  ['technical_summary', 'Technical Summary'],
]

const getApiErrorMessage = (rawError, status, provider) => {
  if (!rawError) return `${provider} request failed with status ${status}.`
  try {
    const parsed = JSON.parse(rawError)
    return parsed?.error?.message || parsed?.message || rawError
  } catch {
    return rawError
  }
}

const cleanJsonResponse = (text) => {
  if (!text) return ''
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
}

const callGemini = async (prompt) => {
  let text = ''
  let lastError = ''

  for (const model of modelCandidates) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      },
    )

    if (response.ok) {
      const data = await response.json()
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
      break
    }

    const rawError = await response.text().catch(() => '')
    const errorMessage = getApiErrorMessage(rawError, response.status, 'Gemini')
    const modelUnavailable = response.status === 404 && /not found|not supported for generateContent/i.test(errorMessage)

    if (modelUnavailable) {
      lastError = `Model "${model}" is unavailable.`
      continue
    }

    throw new Error(errorMessage)
  }

  if (!text) {
    throw new Error(lastError || 'No compatible Gemini model is currently available for generateContent.')
  }

  return text
}

const callOpenRouter = async (prompt) => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + OPENROUTER_API_KEY,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (!response.ok) {
    const rawError = await response.text().catch(() => '')
    throw new Error(getApiErrorMessage(rawError, response.status, 'OpenRouter'))
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content || ''
  if (!text) throw new Error('OpenRouter returned an empty response.')
  return text
}

function App() {
  const [prTitle, setPrTitle] = useState('')
  const [prDescription, setPrDescription] = useState('')
  const [prDiff, setPrDiff] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  const canSubmit = useMemo(() => prDiff.trim() && !loading, [prDiff, loading])

  const narrate = async () => {
    setError('')
    setResult(null)

    if (!GEMINI_API_KEY && !OPENROUTER_API_KEY) {
      setError(
        'Missing API keys. Set VITE_GEMINI_API_KEY and/or VITE_OPENROUTER_API_KEY before narrating.',
      )
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
      const providers = [
        GEMINI_API_KEY ? { label: 'Gemini', run: callGemini } : null,
        OPENROUTER_API_KEY ? { label: 'OpenRouter', run: callOpenRouter } : null,
      ].filter(Boolean)
      const providerErrors = []

      for (const provider of providers) {
        try {
          const text = await provider.run(prompt)
          const parsed = JSON.parse(cleanJsonResponse(text))
          setResult(parsed)
          return
        } catch (providerError) {
          providerErrors.push(`${provider.label}: ${providerError?.message || 'Request failed.'}`)
        }
      }

      throw new Error(providerErrors.join(' | ') || 'Failed to narrate PR.')
    } catch (e) {
      setError(e.message || 'Failed to narrate PR.')
    } finally {
      setLoading(false)
    }
  }

  const copyValue = async (value) => {
    const content = Array.isArray(value) ? value.join('\n') : String(value ?? '')
    await navigator.clipboard.writeText(content)
  }

  const renderValue = (value) => {
    if (Array.isArray(value)) {
      return (
        <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
          {value.map((item, index) => (
            <li key={`${item}-${index}`} style={{ marginBottom: '0.35rem' }}>
              {item}
            </li>
          ))}
        </ul>
      )
    }
    return <p style={{ margin: '0.5rem 0 0', lineHeight: 1.5 }}>{value || '—'}</p>
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#0d1117',
        color: '#c9d1d9',
        padding: '2rem 1rem',
        fontFamily: 'Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      }}
    >
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        <h1 style={{ margin: 0, color: '#f0f6fc' }}>PRNarrator</h1>
        <p style={{ marginTop: '0.5rem', color: '#8b949e' }}>Generate polished PR summaries with Gemini or OpenRouter.</p>

        <section
          style={{
            marginTop: '1.5rem',
            border: '1px solid #30363d',
            borderRadius: 12,
            padding: '1rem',
            background: '#161b22',
          }}
        >
          <label style={{ display: 'block', marginBottom: '0.4rem' }}>PR Title (optional)</label>
          <input
            value={prTitle}
            onChange={(e) => setPrTitle(e.target.value)}
            placeholder="e.g. Add OAuth callback handling"
            style={inputStyle}
          />

          <label style={{ display: 'block', margin: '0.9rem 0 0.4rem' }}>PR Description (optional)</label>
          <textarea
            value={prDescription}
            onChange={(e) => setPrDescription(e.target.value)}
            placeholder="Optional context from the PR description"
            rows={4}
            style={inputStyle}
          />

          <label style={{ display: 'block', margin: '0.9rem 0 0.4rem' }}>PR Diff (required)</label>
          <textarea
            value={prDiff}
            onChange={(e) => setPrDiff(e.target.value)}
            placeholder="Paste git diff here..."
            rows={12}
            style={inputStyle}
          />

          <button
            onClick={narrate}
            disabled={!canSubmit}
            style={{
              marginTop: '1rem',
              background: canSubmit ? '#238636' : '#3b434c',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '0.65rem 1rem',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              fontWeight: 600,
            }}
          >
            {loading ? 'Analyzing…' : 'Analyze PR'}
          </button>

          {error && <p style={{ color: '#ff7b72', marginTop: '0.8rem' }}>{error}</p>}
        </section>

        {result && (
          <section
            style={{
              display: 'grid',
              gap: '0.9rem',
              marginTop: '1.2rem',
            }}
          >
            {outputFields.map(([key, label]) => (
              <article
                key={key}
                style={{
                  border: '1px solid #30363d',
                  borderRadius: 12,
                  background: '#161b22',
                  padding: '1rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                  <h2 style={{ margin: 0, fontSize: '1rem', color: '#f0f6fc' }}>{label}</h2>
                  <button
                    onClick={() => copyValue(result[key])}
                    style={{
                      background: '#21262d',
                      color: '#c9d1d9',
                      border: '1px solid #30363d',
                      borderRadius: 6,
                      padding: '0.4rem 0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    Copy
                  </button>
                </div>
                {renderValue(result[key])}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid #30363d',
  borderRadius: 8,
  background: '#0d1117',
  color: '#c9d1d9',
  padding: '0.65rem 0.75rem',
}

export default App
