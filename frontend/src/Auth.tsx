import Brand from './Brand'
import { useState } from 'react'
import type { FormEvent } from 'react'
import App from './App'
import { authenticatePatient } from './api'
import './Auth.css'
import { clearPortalSession, readPortalSession, savePortalSession } from './session'
import type { PortalSession } from './session'


// Restore this tab’s prototype account state after refresh; sign-out removes it.
export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [session, setSession] = useState<PortalSession | null>(() => readPortalSession())
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [values, setValues] = useState({ name: '', birth: '', email: '', password: '', confirm: '' })
  const signup = mode === 'signup'
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const latestBirthDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  function rememberSession(next: PortalSession) {
    savePortalSession(next)
    setSession(next)
  }

  function switchMode() {
    if (isSubmitting) return
    setMode(signup ? 'login' : 'signup')
    setValues({ name: '', birth: '', email: '', password: '', confirm: '' })
    setShowPassword(false)
    setMessage('')
    setError('')
  }

  function enterDemo() {
    if (isSubmitting) return
    setValues({ name: '', birth: '', email: '', password: '', confirm: '' })
    rememberSession({ profile: { name: 'Alex Morgan', email: 'alex@example.com', birth: '1994-06-15' }, sampleRequests: true })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    setMessage('')
    setError('')
    if (signup && !values.name.trim()) { setError('Please enter your full name.'); return }
    if (signup && values.password !== values.confirm) { setError('Your passwords don’t match. Please try again.'); return }
    setIsSubmitting(true)
    try {
      const patient = await authenticatePatient(mode, values)
      setValues({ name: '', birth: '', email: '', password: '', confirm: '' })
      rememberSession({
        patientId: patient.id,
        profile: { name: patient.name, email: patient.email, birth: patient.date_of_birth || '' },
        sampleRequests: false,
      })
    } catch (requestError) {
      setValues(current => ({ ...current, password: '', confirm: '' }))
      setError(requestError instanceof Error ? requestError.message : 'Unable to connect. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (session) {
    return <App key={session.patientId ?? 'demo'} patientId={session.patientId} initialProfile={session.profile} sampleRequests={session.sampleRequests} onSignOut={() => {
      clearPortalSession()
      setSession(null)
      setMode('login')
      setShowPassword(false)
      setError('')
      setMessage('You have signed out. You can log in again to see your linked prescriptions.')
    }} />
  }

  return <div className="auth-shell">
    <section className="auth-story" aria-label="About RxRescue">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); if (signup) switchMode() }} aria-label="RxRescue home"><Brand /></a>
      <div className="auth-story-content">
        <span className="eyebrow">A BETTER CONNECTION TO YOUR CARE</span>
        <h1>Your next step<br />to a prescription<br /><span>within reach.</span></h1>
        <p>When your medication costs too much or isn’t covered, you don’t have to figure it out alone.</p>
        <div className="auth-illustration" aria-hidden="true"><div className="auth-ring"/><div className="auth-paper"><span>℞</span><div/><div/><p>Care that keeps moving.</p><span className="auth-paper-pill"/></div><div className="auth-float"><span>✓</span> A little less worry.<br/><strong>A little more support.</strong></div></div>
        <div className="auth-benefits"><span><b>01</b> Share your medication issue</span><span><b>02</b> Request a provider review</span><span><b>03</b> Follow every next step</span></div>
      </div>
      <small>RxRescue · Patient portal</small>
    </section>
    <section className="auth-main">
      <div className="auth-top"><span>YOUR CARE STARTS HERE</span><span className="demo-tag">Frontend preview</span></div>
      <div className="auth-card">
        <div className="auth-label">{signup ? 'A FRESH START' : 'GOOD TO SEE YOU'}</div>
        <h2>{signup ? 'Let’s get to know you.' : 'Welcome back.'}</h2>
        <p className="auth-intro">{signup ? 'A few details to start your patient profile.' : 'Log in to keep your care moving forward.'}</p>
        <div className="auth-tabs" aria-label="Account options"><button type="button" disabled={isSubmitting} aria-pressed={!signup} className={!signup ? 'selected' : ''} onClick={() => { if (signup) switchMode() }}>Log in</button><button type="button" disabled={isSubmitting} aria-pressed={signup} className={signup ? 'selected' : ''} onClick={() => { if (!signup) switchMode() }}>Sign up</button></div>
        <div className="auth-preview-note">{signup ? 'Create a demo account using sample details. Your profile is stored in the local development database.' : 'Login using the credentials you signed up with to access the portal.'}</div>
        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert" id="auth-error">{error}</p>}
        <form onSubmit={submit} aria-busy={isSubmitting}><fieldset disabled={isSubmitting} style={{ display: 'contents', border: 0, padding: 0, margin: 0 }}>
          {signup && <div className="auth-name-fields"><label htmlFor="full-name">Full name<input id="full-name" name="name" autoComplete="name" required maxLength={120} value={values.name} onChange={e => setValues({ ...values, name: e.target.value })} placeholder="Alex Morgan"/></label><label htmlFor="birth">Date of birth<input id="birth" name="birth" type="date" autoComplete="bday" required max={latestBirthDate} value={values.birth} onChange={e => setValues({ ...values, birth: e.target.value })}/></label></div>}
          <label htmlFor="email">Email address<input id="email" name="email" type="email" autoComplete="email" required value={values.email} onChange={e => setValues({ ...values, email: e.target.value })} placeholder="you@example.com"/></label>
          <label htmlFor="password">Password<div className="auth-password"><input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} required maxLength={128} minLength={signup ? 8 : undefined} aria-describedby={signup ? 'password-hint' : undefined} value={values.password} onChange={e => setValues({ ...values, password: e.target.value })} placeholder={signup ? 'Create a sample password' : 'Enter your password'}/><button type="button" disabled={isSubmitting} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Hide' : 'Show'}</button></div></label>
          {signup && <><small id="password-hint" className="auth-hint">Use at least 8 characters. Your password is stored as a one-way hash.</small><label htmlFor="confirm-password">Confirm password<input id="confirm-password" name="confirm" type={showPassword ? 'text' : 'password'} autoComplete="new-password" required aria-invalid={!!error} aria-describedby={error ? 'auth-error' : undefined} value={values.confirm} onChange={e => { setValues({ ...values, confirm: e.target.value }); setError('') }} placeholder="Enter your password again"/></label></>}
          {!signup && <button className="auth-forgot text-button" type="button" disabled={isSubmitting} onClick={() => setMessage('Password reset will be available when accounts are connected. No reset email has been sent.')}>Forgot password?</button>}
          <button className="primary auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? (signup ? 'Creating account…' : 'Logging in…') : signup ? 'Create my patient profile' : 'Log in'}<span aria-hidden="true">→</span></button>
        </fieldset></form>
        <div className="auth-divider"><span>or take a look around</span></div>
        <button type="button" disabled={isSubmitting} className="auth-demo-button" onClick={enterDemo}>Explore the demo <span aria-hidden="true">↗</span></button>
        <p className="auth-switch">{signup ? 'Already have an account?' : 'New to RxRescue?'} <button type="button" disabled={isSubmitting} onClick={switchMode}>{signup ? 'Log in' : 'Sign up'}</button></p>
      </div>
      <footer className="auth-footer">A little less friction. A little more care.</footer>
    </section>
  </div>
}
