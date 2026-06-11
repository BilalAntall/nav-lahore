import { useState } from 'react'
import {
  createUserWithEmailAndPassword,
  reload,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { auth, googleProvider } from '../firebase/config.js'
import loginBg from '../assets/login_signup_img.png'

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.5-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.7 19 12 24 12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34 6.5 29.3 4 24 4 16.3 4 9.7 8.4 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-1.9 13.5-5.1l-6.2-5.2C29.5 35.5 26.9 36 24 36c-5.2 0-9.7-3.2-11.3-7.9l-6.6 5.1C9.6 39.5 16.3 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.9 2.4-2.5 4.4-4.6 5.7l6.2 5.2C40.6 36.1 44 30.5 44 24c0-1.2-.1-2.5-.4-3.5z" />
    </svg>
  )
}

function Spinner() {
  return (
    <span
      className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"
      aria-hidden="true"
    />
  )
}

export default function AuthPage({ onAuthSuccess, onDemoLogin }) {
  const [mode, setMode] = useState('landing')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(false)

  const clearForm = () => {
    setEmail('')
    setPassword('')
    setName('')
    setError('')
  }

  const switchMode = (next) => {
    clearForm()
    setMode(next)
  }

  const handleEmailAuth = async (event) => {
    event.preventDefault()
    setError('')

    if (!auth) {
      setError('Firebase is not configured yet. Check your .env.local values.')
      return
    }

    const cleanEmail = email.trim()
    const cleanName = name.trim()
    const validationError = validateEmailForm({ mode, email: cleanEmail, password, name: cleanName })

    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password)
        if (cleanName) {
          await updateProfile(cred.user, { displayName: cleanName })
        }
        await sendEmailVerification(cred.user)
        setEmail(cleanEmail)
        setMode('verify')
        return
      }

      const cred = await signInWithEmailAndPassword(auth, cleanEmail, password)
      await reload(cred.user)

      if (!cred.user.emailVerified) {
        await sendEmailVerification(cred.user)
        await signOut(auth)
        setEmail(cleanEmail)
        setMode('verify')
        return
      }

      onAuthSuccess()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (resendCooldown) return
    setError('')

    if (!auth) {
      setError('Firebase is not configured yet. Check your .env.local values.')
      return
    }

    if (!email.trim() || !password) {
      setError('Go back to login, enter your email and password, then resend the verification email.')
      return
    }

    setResendCooldown(true)
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password)
      await reload(cred.user)

      if (cred.user.emailVerified) {
        await signOut(auth)
        setMode('login')
        setError('Your email is already verified. Please log in now.')
        return
      }

      await sendEmailVerification(cred.user)
      await signOut(auth)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setTimeout(() => setResendCooldown(false), 30000)
    }
  }

  const handleGoogle = async () => {
    setError('')

    if (!auth) {
      setError('Firebase is not configured yet. Check your .env.local values.')
      return
    }

    setGoogleLoading(true)
    try {
      await signInWithPopup(auth, googleProvider)
      onAuthSuccess()
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setGoogleLoading(false)
    }
  }

  const renderVerify = () => (
    <div className="auth-card">
      <div className="auth-logo-row">
        <div className="auth-logo-badge">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l2-9h14l2 9" /><path d="M3 17h18" /><path d="M8 17v2" /><path d="M16 17v2" /><circle cx="8" cy="13" r="1" /><circle cx="16" cy="13" r="1" />
          </svg>
        </div>
        <span className="auth-logo-text">NavLahore</span>
      </div>

      <div className="verify-icon" aria-hidden="true">Email</div>
      <h2 className="auth-heading">Check your inbox</h2>
      <p className="auth-subheading">
        We sent a verification link to <strong>{email}</strong>. Click it to activate your account, then come back and log in.
      </p>

      {error && <p className="auth-error" role="alert">{error}</p>}

      <button
        id="btn-resend-verification"
        className="auth-submit-btn"
        onClick={handleResend}
        disabled={resendCooldown}
        type="button"
      >
        {resendCooldown ? 'Email sent! Wait 30s' : 'Resend verification email'}
      </button>

      <button
        id="btn-back-to-login"
        type="button"
        className="auth-back-btn"
        onClick={() => switchMode('login')}
      >
        Back to Log In
      </button>
    </div>
  )

  const renderForm = () => (
    <div className="auth-card">
      <div className="auth-logo-row">
        <div className="auth-logo-badge">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l2-9h14l2 9" /><path d="M3 17h18" /><path d="M8 17v2" /><path d="M16 17v2" /><circle cx="8" cy="13" r="1" /><circle cx="16" cy="13" r="1" />
          </svg>
        </div>
        <span className="auth-logo-text">NavLahore</span>
      </div>

      <h2 className="auth-heading">
        {mode === 'login' ? 'Welcome back' : 'Create account'}
      </h2>
      <p className="auth-subheading">
        {mode === 'login'
          ? 'Sign in to continue to NavLahore.'
          : 'Join NavLahore and navigate Lahore smarter.'}
      </p>

      <button
        id="btn-google-auth"
        className="auth-google-btn"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
        type="button"
      >
        {googleLoading ? <Spinner /> : <GoogleIcon />}
        <span>{mode === 'login' ? 'Continue with Google' : 'Sign up with Google'}</span>
      </button>

      <div className="auth-divider"><span>or</span></div>

      <form onSubmit={handleEmailAuth} className="auth-form" noValidate>
        {mode === 'signup' && (
          <div className="auth-field">
            <label htmlFor="auth-name">Full name</label>
            <input
              id="auth-name"
              type="text"
              placeholder="Ali Hassan"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setError('')
              }}
              required
              autoComplete="name"
            />
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="auth-email">Email address</label>
          <input
            id="auth-email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            required
            autoComplete="email"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            placeholder={mode === 'signup' ? 'At least 6 characters' : 'Password'}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError('')
            }}
            required
            minLength={6}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          />
        </div>

        {error && <p className="auth-error" role="alert">{error}</p>}

        <button
          id={mode === 'login' ? 'btn-login-submit' : 'btn-signup-submit'}
          type="submit"
          className="auth-submit-btn"
          disabled={loading || googleLoading}
        >
          {loading ? <Spinner /> : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>

      <p className="auth-switch">
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          id={mode === 'login' ? 'link-go-signup' : 'link-go-login'}
          type="button"
          className="auth-switch-link"
          onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>

      <button
        id="btn-back-landing"
        type="button"
        className="auth-back-btn"
        onClick={() => switchMode('landing')}
      >
        Back
      </button>
    </div>
  )

  const renderLanding = () => (
    <div className="auth-landing-card">
      <div className="auth-logo-row">
        <div className="auth-logo-badge">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 17l2-9h14l2 9" /><path d="M3 17h18" /><path d="M8 17v2" /><path d="M16 17v2" /><circle cx="8" cy="13" r="1" /><circle cx="16" cy="13" r="1" />
          </svg>
        </div>
        <span className="auth-logo-text">NavLahore</span>
      </div>

      <h1 className="landing-heading">
        Navigate<br />Lahore
      </h1>
      <p className="landing-sub">One City. One App. All Transport.</p>

      <div className="landing-btns">
        <button
          id="btn-landing-signup"
          className="landing-btn-primary"
          onClick={() => switchMode('signup')}
        >
          Sign Up <span aria-hidden="true">-&gt;</span>
        </button>
        <button
          id="btn-landing-login"
          className="landing-btn-secondary"
          onClick={() => switchMode('login')}
        >
          Log In
        </button>
        <button
          id="btn-landing-google"
          className="landing-btn-google"
          onClick={handleGoogle}
          disabled={googleLoading}
          type="button"
        >
          {googleLoading ? <Spinner /> : <GoogleIcon />}
          <span>Continue with Google</span>
        </button>
      </div>

      {error && <p className="auth-error-dark mt-3" role="alert">{error}</p>}
      {!auth && (
        <button
          id="btn-demo-mode"
          className="landing-btn-secondary"
          style={{ marginTop: '1.25rem', backgroundColor: '#10b981', color: 'white', border: 'none', fontWeight: '600' }}
          onClick={onDemoLogin}
          type="button"
        >
          Enter Demo Mode (Offline)
        </button>
      )}
    </div>
  )

  return (
    <div className="auth-root">
      <img
        src={loginBg}
        alt="Aerial view of Lahore"
        className="auth-bg-img"
        aria-hidden="true"
      />
      <div className="auth-overlay" aria-hidden="true" />

      <div className="auth-content">
        {mode === 'landing' && renderLanding()}
        {mode === 'verify' && renderVerify()}
        {(mode === 'login' || mode === 'signup') && renderForm()}
      </div>
    </div>
  )
}

function validateEmailForm({ mode, email, password, name }) {
  if (!email) return 'Please enter your email address.'
  if (!email.includes('@')) return 'Please enter a valid email address.'
  if (!password) return 'Please enter your password.'
  if (mode === 'signup' && !name) return 'Please enter your full name.'
  if (mode === 'signup' && password.length < 6) return 'Password must be at least 6 characters.'
  return ''
}

function friendlyError(error) {
  const code = typeof error === 'string' ? error : error?.code
  const map = {
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/invalid-credential': 'Email or password is incorrect. Please check both and try again.',
    'auth/missing-password': 'Please enter your password.',
    'auth/missing-email': 'Please enter your email address.',
    'auth/email-already-in-use': 'An account with this email already exists. Try logging in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/requires-recent-login': 'Please log in again, then retry this action.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in popup. Allow popups and try again.',
    'auth/account-exists-with-different-credential': 'This email is already linked to another sign-in method.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/too-many-requests': 'Too many failed attempts. Please wait a few minutes, then try again.',
    'auth/operation-not-allowed': 'This sign-in method is not enabled in Firebase.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/invalid-api-key': 'Firebase API key is invalid. Check your .env.local file.',
    'auth/app-not-authorized': 'This domain is not authorized for Firebase Auth. Add it in Firebase Authentication settings.',
  }

  return map[code] || 'Something went wrong. Please try again.'
}
