import { useState } from 'react'
import { GoogleLogo } from '@phosphor-icons/react'
import { useAuth } from '../state/useAuth'
import SplashBackground from './SplashBackground'
import ForgotPasswordModal from './ForgotPasswordModal'
import './SplashScreen.css'

export default function SplashScreen({ onGuest }) {
  const { signUp, signInWithPassword, signInWithGoogle } = useAuth()
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [forgotOpen, setForgotOpen] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'signup') await signUp(email, password)
      else await signInWithPassword(email, password)
    } catch (err) {
      setError(err.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  async function google() {
    setBusy(true)
    setError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err.message || 'Google sign-in failed.')
      setBusy(false)
    }
  }

  return (
    <div className="splash">
      <aside className="splash-pane-left">
        <SplashBackground />
      </aside>
      <div className="splash-pane-right">
        <div className="splash-card">
        <h1 className="splash-brand">petprint</h1>
        <p className="splash-tagline">Turn your pet's nicknames into a printable word cloud shaped like them.</p>

        <form onSubmit={submit} className="splash-form">
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </label>
          {error && <p className="splash-error">{error}</p>}
          <button type="submit" className="splash-primary" disabled={busy}>
            {busy ? '…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </button>
          {mode === 'signin' && (
            <button
              type="button"
              className="splash-forgot"
              onClick={() => setForgotOpen(true)}
              disabled={busy}
            >
              Forgot password?
            </button>
          )}
        </form>

        <div className="splash-divider"><span>or</span></div>

        <button className="splash-google" onClick={google} disabled={busy} type="button">
          <GoogleLogo size={18} weight="bold" />
          <span>Continue with Google</span>
        </button>

        <p className="splash-toggle">
          {mode === 'signin' ? (
            <>No account? <button type="button" onClick={() => setMode('signup')}>Sign up</button></>
          ) : (
            <>Already have one? <button type="button" onClick={() => setMode('signin')}>Sign in</button></>
          )}
        </p>

        {onGuest && (
          <button type="button" className="splash-guest" onClick={onGuest} disabled={busy}>
            Continue without an account
          </button>
        )}
        <p className="splash-legal">
          By signing in you agree to our{' '}
          <a href={`${import.meta.env.BASE_URL}legal/terms.html`} target="_blank" rel="noopener noreferrer">Terms</a>{' '}
          and{' '}
          <a href={`${import.meta.env.BASE_URL}legal/privacy.html`} target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
        </p>
        </div>
      </div>
      <ForgotPasswordModal
        open={forgotOpen}
        initialEmail={email}
        onClose={() => setForgotOpen(false)}
      />
    </div>
  )
}
