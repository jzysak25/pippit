'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

type Step = 'api_key' | 'new_or_existing' | 'register' | 'login'

export default function SetupPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('api_key')
  const [apiKey, setApiKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({ username: '', email: '', password: '', identifier: '' })

  async function handleApiKey(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const res = await fetch('/api/validate-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey }),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Invalid key')
      return
    }
    localStorage.setItem('apiKey', apiKey)
    setStep('new_or_existing')
  }

  async function handleAuth(action: 'register' | 'login') {
    setError('')
    setLoading(true)
    const body =
      action === 'register'
        ? { action, username: form.username, email: form.email, password: form.password }
        : { action, identifier: form.identifier, password: form.password }

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setLoading(false)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Failed')
      return
    }
    router.push('/chat')
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: 'var(--surface)',
    border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)',
    outline: 'none', marginBottom: 12,
  }
  const btnStyle: React.CSSProperties = {
    width: '100%', padding: '11px', background: 'var(--accent)',
    border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, fontSize: 15,
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 360, padding: 32, background: 'var(--surface)', borderRadius: 16, border: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700 }}>Pippit</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>AI peer-to-peer marketplace</p>
        </div>

        {step === 'api_key' && (
          <form onSubmit={handleApiKey}>
            <label style={{ fontSize: 13, color: 'var(--muted)', display: 'block', marginBottom: 6 }}>
              Google AI Studio API Key
            </label>
            <input
              style={inputStyle} type="password" placeholder="AIza..."
              value={apiKey} onChange={e => setApiKey(e.target.value)} required
            />
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
              Get a free key at <a href="https://openrouter.ai/keys" target="_blank">openrouter.ai</a>. Stored locally only.
            </p>
            {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button style={btnStyle} disabled={loading}>{loading ? 'Validating...' : 'Continue'}</button>
          </form>
        )}

        {step === 'new_or_existing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 4 }}>Do you have an account?</p>
            <button style={btnStyle} onClick={() => setStep('login')}>Log in</button>
            <button style={{ ...btnStyle, background: 'var(--accent-dim)' }} onClick={() => setStep('register')}>Create account</button>
          </div>
        )}

        {step === 'register' && (
          <form onSubmit={e => { e.preventDefault(); handleAuth('register') }}>
            <input style={inputStyle} placeholder="Username" value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))} required />
            <input style={inputStyle} type="email" placeholder="Email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
            <input style={inputStyle} type="password" placeholder="Password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button style={btnStyle} disabled={loading}>{loading ? 'Creating...' : 'Create account'}</button>
            <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
              <a href="#" onClick={() => setStep('login')}>Already have an account?</a>
            </p>
          </form>
        )}

        {step === 'login' && (
          <form onSubmit={e => { e.preventDefault(); handleAuth('login') }}>
            <input style={inputStyle} placeholder="Username or email" value={form.identifier}
              onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))} required />
            <input style={inputStyle} type="password" placeholder="Password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required />
            {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <button style={btnStyle} disabled={loading}>{loading ? 'Logging in...' : 'Log in'}</button>
            <p style={{ textAlign: 'center', marginTop: 12, fontSize: 13, color: 'var(--muted)' }}>
              <a href="#" onClick={() => setStep('register')}>Create an account</a>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
