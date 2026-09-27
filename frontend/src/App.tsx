import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'
import { getReportResetEnabled, loadPrescriptions, resetPatientReports } from './api'
import type { Prescription, PrescriptionSnapshot } from './api'
import PatientAuditTrail from './PatientAuditTrail'

type Page = 'Overview' | 'My prescriptions' | 'My requests' | 'My profile'
const portalPages: Page[] = ['Overview', 'My prescriptions', 'My requests', 'My profile']

function pageStorageKey(patientId?: number) {
  return `rxrescue.portal.page.${patientId ?? 'demo'}`
}

function readSavedPage(patientId?: number): Page {
  try {
    const savedPage = window.sessionStorage.getItem(pageStorageKey(patientId))
    return portalPages.find(page => page === savedPage) ?? 'Overview'
  } catch {
    return 'Overview'
  }
}

type Request = { prescriptionId?: string; provider?: string; id: string; medication: string; issue: string; pharmacy: string; date: string; status: 'Under review' | 'Prescription sent' | 'Submitted' | 'Resolved'; originalPrescription?: PrescriptionSnapshot; replacementPrescription?: PrescriptionSnapshot | null }
type SavedReport = { id: number; prescription_id: number; medication: string; issue: string; status: Request['status']; created_at: string; original_prescription?: PrescriptionSnapshot; replacement_prescription?: PrescriptionSnapshot | null }
const initialRequests: Request[] = [
  { id: 'DU-1042', medication: 'Jardiance · 10 mg', issue: 'Not covered by insurance', pharmacy: 'Peachtree Pharmacy', date: 'Sep 24, 2026', status: 'Under review' },
  { id: 'DU-1038', medication: 'Symbicort · 80/4.5 mcg', issue: 'Medication is too expensive', pharmacy: 'Peachtree Pharmacy', date: 'Sep 18, 2026', status: 'Prescription sent' },
]
// Placeholder records for the proposed Impiricus prescription feed; never fetched patient data.
const samplePrescriptions: Prescription[] = [
  { id: 'sample-rx-01', instructions: 'Sample prescription — follow your provider’s instructions.', active: true, medication: 'Jardiance · 10 mg', provider: 'Dr. Taylor · Sample provider', pharmacy: 'Peachtree Pharmacy' },
  { id: 'sample-rx-02', instructions: 'Sample prescription — follow your provider’s instructions.', active: true, medication: 'Symbicort · 80/4.5 mcg', provider: 'Dr. Taylor · Sample provider', pharmacy: 'Peachtree Pharmacy' },
]
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    file: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6"/>,
    check: <path d="m5 12 4 4L19 6"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/></>,
    pill: <><path d="m9 4-5 5a6 6 0 0 0 8 9l6-6a6 6 0 0 0-9-8Z M7 7l9 9"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3h.01"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.file}</svg>
}
type AppProps = {
  patientId?: number
  initialProfile: { name: string; email: string; birth: string }
  sampleRequests: boolean
  onSignOut: () => void
}

function App({ initialProfile, sampleRequests, onSignOut, patientId }: AppProps) {
  const [page, setPage] = useState<Page>(() => readSavedPage(patientId))
  useEffect(() => {
    try {
      window.sessionStorage.setItem(pageStorageKey(patientId), page)
    } catch {
      // The portal remains navigable when browser storage is unavailable.
    }
  }, [page, patientId])
  const [resetEnabled, setResetEnabled] = useState(import.meta.env.DEV && sampleRequests)
  const [resetOpen, setResetOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState('')
  const [isSavingReport, setIsSavingReport] = useState(false)
  useEffect(() => {
    if (!import.meta.env.DEV || sampleRequests) return
    const controller = new AbortController()
    getReportResetEnabled(controller.signal)
      .then(enabled => { if (!controller.signal.aborted) setResetEnabled(enabled) })
      .catch(() => { /* Keep developer controls hidden when the backend is unavailable. */ })
    return () => controller.abort()
  }, [sampleRequests])
  const [requests, setRequests] = useState<Request[]>(sampleRequests ? initialRequests : [])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(sampleRequests ? samplePrescriptions : [])
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(!sampleRequests && !!patientId)
  const [prescriptionsError, setPrescriptionsError] = useState(!sampleRequests && !patientId ? 'Please sign out and log in again to load your prescriptions.' : '')
  const [reloadPrescriptions, setReloadPrescriptions] = useState(0)
  const [requestsLoading, setRequestsLoading] = useState(patientId !== undefined && !sampleRequests)
  const [requestError, setRequestError] = useState('')
  useEffect(() => {
    if (sampleRequests) return
    const controller = new AbortController()
    if (!patientId) return () => controller.abort()
    loadPrescriptions(patientId, controller.signal)
      .then(records => { if (!controller.signal.aborted) setPrescriptions(records.filter(prescription => prescription.active)) })
      .catch(error => { if (!controller.signal.aborted) setPrescriptionsError(error instanceof Error ? error.message : 'Unable to load prescriptions.') })
      .finally(() => { if (!controller.signal.aborted) setPrescriptionsLoading(false) })
    return () => controller.abort()
  }, [patientId, sampleRequests, reloadPrescriptions])
  const [creating, setCreating] = useState(false)
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Request | null>(null)
  const [help, setHelp] = useState(false)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('All requests')
  const [profile, setProfile] = useState(initialProfile)
  const [form, setForm] = useState({ name: '', birth: '', email: '', prescriptionId: '', medication: '', issue: '', pharmacy: '', provider: '', updates: false })
  useEffect(() => {
    if (patientId === undefined || sampleRequests) return
    let cancelled = false
    fetch(`/api/reports/${patientId}`)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load your saved reports.')
        return await response.json() as SavedReport[]
      })
      .then(data => {
        if (!cancelled) setRequests(data.map(report => ({
          id: `DU-${report.id}`,
          prescriptionId: String(report.prescription_id),
          medication: report.medication,
          issue: report.issue,
          pharmacy: '',
          date: new Date(report.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: report.status,
          originalPrescription: report.original_prescription,
          replacementPrescription: report.replacement_prescription,
        })))
      })
      .catch(error => {
        if (!cancelled) setRequestError(error instanceof Error ? error.message : 'Unable to load your saved reports.')
      })
      .finally(() => {
        if (!cancelled) setRequestsLoading(false)
      })
    return () => { cancelled = true }
  }, [patientId, sampleRequests])
  useEffect(() => {
    if (!creating && !selected && !help && !resetOpen) return
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = document.querySelector<HTMLElement>('[role=dialog]')
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') || [])
    focusable()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isResetting && !isSavingReport) { setCreating(false); setSelected(null); setHelp(false); setResetOpen(false) }
      if (e.key === 'Tab') {
        const elements = focusable(), first = elements[0], last = elements[elements.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [creating, selected, help, resetOpen, isResetting, isSavingReport])
  async function resetReports() {
    if (!resetEnabled || isResetting || isSavingReport || requestsLoading) return
    setIsResetting(true)
    setResetError('')
    try {
      if (!sampleRequests && !patientId) throw new Error('Please sign in again before resetting reports.')
      const count = sampleRequests ? requests.length : await resetPatientReports(patientId!)
      setRequests([])
      setSelected(null)
      setRequestError('')
      setFilter('All requests')
      setResetOpen(false)
      setNotice(`${count} report${count === 1 ? '' : 's'} cleared${sampleRequests ? ' from this demo session' : ' from this patient account'}. Your account and prescriptions are unchanged.`)
    } catch (error) {
      setResetError(error instanceof Error ? error.message : 'Unable to reset reports. Please try again.')
    } finally {
      setIsResetting(false)
    }
  }
  function reportPrescription(prescription: Prescription) {
    if (!prescription.active) return
    setStep(1); setCreating(true); setNotice(''); setRequestError('')
    setForm({ name: profile.name, birth: profile.birth, email: profile.email,
      prescriptionId: prescription.id, medication: prescription.medication,
      issue: '',
      pharmacy: prescription.pharmacy, provider: prescription.provider, updates: false })
  }
  function refreshPrescriptions() {
    if (!patientId) return
    setPrescriptions([]); setPrescriptionsError(''); setPrescriptionsLoading(true)
    setReloadPrescriptions(value => value + 1)
  }

  function choosePrescription() { setPage('My prescriptions') }

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (isSavingReport || isResetting) return
    if (step > 0 && !prescriptions.some(prescription => prescription.id === form.prescriptionId && prescription.active)) return
    if (step < 2) { setStep(step + 1); return }
    setIsSavingReport(true)
    setRequestError('')
    try {
    let request: Request = { prescriptionId: form.prescriptionId, provider: form.provider, id: `DU-${1043 + requests.length}`, medication: form.medication, issue: form.issue, pharmacy: form.pharmacy, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: 'Submitted' }
    if (patientId !== undefined && !sampleRequests) {
      try {
        const response = await fetch(`/api/reports/${patientId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prescription_id: Number(form.prescriptionId), issue: form.issue }),
        })
        const result = await response.json() as SavedReport | { detail?: unknown }
        if (!response.ok || !('id' in result)) {
          throw new Error('detail' in result && typeof result.detail === 'string' ? result.detail : 'Unable to save your report.')
        }
        request = {
          id: `DU-${result.id}`,
          prescriptionId: String(result.prescription_id),
          medication: result.medication,
          issue: result.issue,
          pharmacy: '',
          date: new Date(result.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
          status: result.status,
        }
      } catch (error) {
        setRequestError(error instanceof Error ? error.message : 'Unable to save your report. Please try again.')
        return
      }
    }
    setRequests(current => [request, ...current]); setCreating(false); setPage('My requests'); setNotice(sampleRequests ? `Demo request ${request.id} created. No information has been sent to a provider.` : `Report ${request.id} saved to your account.`)
    } finally { setIsSavingReport(false) }
  }

  const pending = requests.filter(r => r.status !== 'Prescription sent' && r.status !== 'Resolved').length
  const completed = requests.length - pending
  const trackingSteps = selected?.status === 'Resolved'
    ? ['Submitted', 'Under review', 'Resolved']
    : ['Submitted', 'Under review', 'Prescription sent']
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('Overview') }}><span className="brand-mark"><Icon name="plus" size={26}/></span>Rx<span>Rescue</span><i/></a>
      <div className="portal-label">PATIENT PORTAL</div>
      <nav aria-label="Main navigation">{(['Overview', 'My prescriptions', 'My requests', 'My profile'] as Page[]).map((item, i) => <button key={item} className={page === item ? 'nav-item active' : 'nav-item'} onClick={() => setPage(item)}><Icon name={['grid', 'pill', 'file', 'user'][i]}/>{item}{item === 'My requests' && <span className="nav-count">{requests.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="support-card"><span className="support-icon"><Icon name="help"/></span><h3>A little help along the way.</h3><p>Learn what happens after you send a request.</p><button className="text-button" onClick={() => setHelp(true)}>Visit help center <Icon name="arrow" size={16}/></button></div><div className="sidebar-user"><span className="avatar">{profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><div><strong>{profile.name}</strong><small>Personal account</small></div><button aria-label="Open profile" onClick={() => setPage('My profile')}>↗</button></div><button className="sign-out" disabled={isResetting || isSavingReport} onClick={onSignOut}>Sign out</button></div>
    </aside>
    <div className="workspace"><header className="topbar"><div>My care <span>/</span> <strong>{page}</strong></div><span className="demo-tag">{sampleRequests ? 'Demo workspace' : 'Patient portal'}</span></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow">YOUR HEALTH, A LITTLE SIMPLER</div><h1>{page === 'Overview' ? `Welcome back, ${profile.name.split(' ')[0]}.` : page}</h1><p>{page === 'Overview' ? 'Let’s get your prescription moving in the right direction.' : page === 'My requests' ? 'Follow your requests, from the first step to your pharmacy.' : page === 'My prescriptions' ? 'Choose the prescription you need help with.' : 'Keep your contact information up to date.'}</p></div><div className="date-label">Patient care, connected <span className="green-dot"/></div></div>
      {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
      {page === 'Overview' && <>
        <section className="hero"><div className="hero-copy"><span className="hero-tag"><span/> A clearer path to your prescription</span><h2>Your medication.<br/>More within reach.</h2><p>Select an active prescription below<br className="desktop-break"/> to report a problem.</p></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="floating-plus">+</div><div className="rx-card"><span className="rx-symbol">℞</span><div className="art-line long"/><div className="art-line"/><div className="art-med"><span className="capsule"/><div><div className="art-line long"/><div className="art-line"/></div></div><span className="art-card-check"><Icon name="check" size={16}/> Connected to your care</span></div><div className="art-badge"><span><Icon name="check" size={23}/></span>One step closer<br/><strong>to feeling better.</strong></div></div></section>
        <section className="stats" aria-label="Request summary">{[{ title: 'Total requests', value: requests.length, sub: 'Your care, all in one place', icon: 'file', color: 'blue' }, { title: 'Awaiting provider', value: pending, sub: 'We’ll keep you in the loop', icon: 'clock', color: 'amber' }, { title: 'Resolved or sent', value: completed, sub: 'No longer awaiting review', icon: 'check', color: 'green' }].map(s => <div className="stat" key={s.title}><span className={`stat-icon ${s.color}`}><Icon name={s.icon}/></span><div><span>{s.title}</span><strong>{s.value}</strong><small>{s.sub}</small></div></div>)}</section>
      </>}
      {(page === 'Overview' || page === 'My prescriptions') && <section className="panel prescription-panel" aria-labelledby="prescriptions-title" aria-busy={prescriptionsLoading}>
        <div className="section-heading"><div><h2 id="prescriptions-title">My prescriptions</h2><p>{sampleRequests ? 'Sample prescriptions for exploring the request flow.' : 'Active prescriptions linked to your patient account. Select one to report a problem.'}</p></div>{!sampleRequests && <button className="text-button" disabled={prescriptionsLoading} onClick={refreshPrescriptions}>Refresh</button>}</div>
        {prescriptionsLoading ? <p className="prescription-empty" role="status">Loading your prescriptions…</p> : prescriptionsError ? <div className="prescription-empty" role="alert"><p>{prescriptionsError}</p><button className="secondary" onClick={refreshPrescriptions}>Try again</button></div> : prescriptions.length === 0 ? <div className="prescription-empty"><h3>No active prescriptions linked yet</h3><p>Your account is ready, but there are no active prescriptions attached to it. Once records are linked, they will appear here.</p></div> : <div className="prescription-list">{prescriptions.map(prescription => <button className="prescription-row" key={prescription.id} disabled={!prescription.active} onClick={() => reportPrescription(prescription)}><span className="med-icon"><Icon name="pill" size={23}/></span><span className="prescription-info"><strong>{prescription.medication}</strong>{prescription.instructions && <small>{prescription.instructions}</small>}</span><span className="report-link">{prescription.active ? 'Report a problem' : 'Inactive'}<Icon name="arrow" size={16}/></span></button>)}</div>}

      </section>}
  {page !== 'My prescriptions' && (page !== 'My profile' ? <div className={page === 'Overview' ? 'content-grid' : ''}><section className="panel requests-panel"><div className="section-heading"><div><h2>{page === 'Overview' ? 'Recent requests' : 'Your requests'}</h2><p>A little progress, a little peace of mind.</p></div>{page === 'Overview' ? <button className="text-button" onClick={() => setPage('My requests')}>View all <Icon name="arrow" size={16}/></button> : <button className="primary" onClick={choosePrescription}><Icon name="plus" size={16}/> New request</button>}</div>{page === 'My requests' && <div className="filters">{['All requests', 'Awaiting provider', 'Prescription sent', 'Resolved'].map(f => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>}{requestError && <p className="prescription-state" role="alert">{requestError}</p>}{requestsLoading ? <p className="prescription-state">Loading saved reports…</p> : <div className="request-list">{requests.length === 0 && <div className="empty-requests"><h3>Your next step starts here.</h3><p>No reports yet. Select an active prescription to report a problem.</p></div>}{requests.filter(r => page === 'Overview' || filter === 'All requests' || (filter === 'Awaiting provider' ? r.status !== 'Prescription sent' && r.status !== 'Resolved' : r.status === filter)).slice(0, page === 'Overview' ? 3 : undefined).map(r => <button className="request-row" key={r.id} onClick={() => setSelected(r)}><span className="med-icon"><Icon name="pill" size={23}/></span><div className="request-info"><strong>{r.medication}</strong><span>{r.issue}</span><small>{r.id} <b>·</b> {r.date}</small></div><div className="request-end"><span className={`status ${r.status === 'Prescription sent' || r.status === 'Resolved' ? 'sent' : 'pending'}`}><span/>{r.status}</span><span className="detail-link">View details ↗</span></div></button>)}</div>}<div className="panel-foot">{sampleRequests ? <><Icon name="shield" size={15}/> Sample data for preview. New requests reset when you refresh.</> : <><Icon name="shield" size={15}/> Reports are saved to your patient account.</>}</div></section>
  {page === 'Overview' && <section className="panel how-panel"><span className="eyebrow">HERE FOR EVERY STEP</span><h2>A simpler way forward.</h2><div className="steps">{[['Tell us what’s getting in the way', 'Choose a prescription and tell us the issue.'], ['Your provider takes a look', 'They review your report and options.'], ['Your next step, delivered', 'Track updates right here in your portal.']].map(([title, desc], i) => <div className="how-step" key={title}><span>{i + 1}</span><div><h3>{title}</h3><p>{desc}</p></div></div>)}</div><button className="text-button" onClick={() => setHelp(true)}>How it works <Icon name="arrow" size={16}/></button></section>}</div> : <section className="panel profile-panel"><h2>Personal information</h2><p>{sampleRequests ? 'These are sample details for this demo.' : 'Your account is saved. Profile edits on this screen are not saved to the backend yet.'}</p><form onSubmit={e => { e.preventDefault(); setNotice('Profile updated for this demo session.') }}><label>Full name<input required value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}/></label><label>Email address<input required type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}/></label><label>Date of birth<input required type="date" max={new Date().toISOString().slice(0, 10)} value={profile.birth} onChange={e => setProfile({ ...profile, birth: e.target.value })}/></label><button className="primary">Save changes</button></form></section>)}
      {page === 'Overview' && resetEnabled && <section className="developer-tools" aria-labelledby="developer-tools-title"><div><span className="eyebrow">DEVELOPER TOOLS</span><h2 id="developer-tools-title">Start a fresh demo</h2><p>Clear {sampleRequests ? 'this session’s sample reports' : `saved reports for ${initialProfile.name}`} to test the flow again. Account and prescriptions stay in place.</p></div><button className="reset-button" disabled={requestsLoading || isSavingReport || isResetting || (!requests.length && !requestError)} onClick={() => { setResetError(''); setResetOpen(true) }}>Reset reports</button></section>}
      {page === 'My profile' && <PatientAuditTrail patientId={patientId} />}
      <footer><span className="footer-brand">RxRescue</span><span>A better connection to your care.</span><button onClick={() => setHelp(true)}>Questions? We’re here to help <Icon name="arrow" size={14}/></button></footer>
    </main></div>
    {resetOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" aria-describedby="reset-description" aria-busy={isResetting}><span className="eyebrow">DEVELOPER RESET</span><h2 id="reset-title">Clear reports for {initialProfile.name}?</h2><p id="reset-description" className="reset-description">This deletes {sampleRequests ? 'the reports in this demo session' : 'all saved reports for this patient account'}. {sampleRequests ? 'Sample reports return when you start a new demo session.' : 'They will remain deleted after logging out and back in.'} The account, prescriptions, and other patients’ reports stay unchanged.</p>{resetError && <p className="reset-error" role="alert">{resetError}</p>}<div className="modal-actions"><button className="secondary" disabled={isResetting} onClick={() => setResetOpen(false)}>Cancel</button><button className="reset-button" disabled={isResetting} onClick={resetReports}>{isResetting ? 'Resetting…' : 'Delete reports'}</button></div></section></div>}
    {creating && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="request-title"><button className="close" aria-label="Close request form" disabled={isSavingReport} onClick={() => setCreating(false)}>×</button><span className="eyebrow">LET’S TAKE THE NEXT STEP</span><h2 id="request-title">Report a prescription problem</h2><p className="demo-note">{sampleRequests ? 'Demo reports stay in this session.' : 'Reports are saved to your account.'} Nothing is sent to your provider yet.</p><div className="form-progress">{['Your request', 'Review'].map((s, i) => <span className={i + 1 <= step ? 'current' : ''} key={s}>{i + 1}. {s}</span>)}</div><form onSubmit={submit}>
      {step === 1 && <div className="form-fields">
        <div className="chosen-prescription"><span className="eyebrow">SELECTED PRESCRIPTION</span><h3>{form.medication}</h3><button className="text-button" type="button" disabled={isSavingReport} onClick={() => { setCreating(false); choosePrescription() }}>Choose a different prescription</button></div>
        <label>Cause of report<select required value={form.issue} onChange={e => setForm({ ...form, issue: e.target.value })}><option value="">Select a cause</option><option>Too expensive</option><option>No insurance coverage</option><option>Medical conflicts</option></select></label>
        <p className="muted">Your selected prescription stays attached to this report for provider review.</p>
      </div>}
      {requestError && creating && <p className="auth-error" role="alert">{requestError}</p>}
      {step === 2 && <><dl className="review">{[['Patient', form.name], ['Selected prescription', form.medication], ['Issue', form.issue], ['Provider', form.provider], ['Pharmacy', form.pharmacy]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><label className="checkbox"><input type="checkbox" checked={form.updates} onChange={e => setForm({ ...form, updates: e.target.checked })}/>Email me when my report status changes (demo only).</label><p className="muted">Your provider reviews the reported issue and decides on next steps.</p></>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={() => step > 1 ? setStep(step - 1) : setCreating(false)}>{step > 1 ? 'Back' : 'Cancel'}</button><button className="primary" type="submit" disabled={step === 1 && !prescriptions.some(prescription => prescription.id === form.prescriptionId && prescription.active)}>{step === 2 ? 'Submit report' : 'Continue'}<Icon name="arrow" size={16}/></button></div></form></section></div>}
    {selected && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="close" aria-label="Close request details" onClick={() => setSelected(null)}>×</button><span className="eyebrow">REPORT {selected.id}</span><h2 id="detail-title">Prescription request</h2><p>{selected.issue}</p><div className="tracking">{trackingSteps.map((s, i) => <div className={i <= trackingSteps.indexOf(selected.status) ? 'complete' : ''} key={s}><span><Icon name={i <= trackingSteps.indexOf(selected.status) ? 'check' : 'clock'} size={18}/></span><strong>{s}</strong></div>)}</div><div className="report-prescription-details"><section><h3>Original prescription</h3><dl className="review"><div><dt>Medication</dt><dd>{selected.originalPrescription?.medication || selected.medication}</dd></div>{selected.originalPrescription?.dosage && <div><dt>Dosage</dt><dd>{selected.originalPrescription.dosage}</dd></div>}{selected.originalPrescription?.instructions && <div><dt>Instructions</dt><dd>{selected.originalPrescription.instructions}</dd></div>}<div><dt>Status</dt><dd>{selected.originalPrescription?.active === false ? 'Replaced' : selected.status === 'Resolved' && !selected.replacementPrescription ? 'Active · unchanged' : 'Active'}</dd></div></dl></section>{selected.replacementPrescription && <section><h3>New prescription</h3><dl className="review"><div><dt>Medication</dt><dd>{selected.replacementPrescription.medication}</dd></div><div><dt>Dosage</dt><dd>{selected.replacementPrescription.dosage || 'Not specified'}</dd></div><div><dt>Instructions</dt><dd>{selected.replacementPrescription.instructions || 'Not specified'}</dd></div><div><dt>Status</dt><dd>{selected.replacementPrescription.active ? 'Active' : 'Inactive'}</dd></div></dl><p className="demo-note">Synthetic demo prescription; not for clinical use.</p></section>}</div><dl className="review"><div><dt>Issue</dt><dd>{selected.issue}</dd></div><div><dt>Pharmacy</dt><dd>{selected.pharmacy || 'Not provided'}</dd></div>{selected.provider && <div><dt>Prescribing provider</dt><dd>{selected.provider}</dd></div>}<div><dt>Reported</dt><dd>{selected.date}</dd></div></dl><button className="primary" onClick={() => setSelected(null)}>Back to my requests</button></section></div>}
    {help && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="close" aria-label="Close help" onClick={() => setHelp(false)}>×</button><span className="eyebrow">A LITTLE GUIDANCE</span><h2 id="help-title">From report to review.</h2><div className="help-content"><h3>1. Share your medication issue</h3><p>Choose an active prescription and tell us what is getting in the way. The prescription details are included with your report.</p><h3>2. Review your report</h3><p>Check the selected prescription and issue before submitting. This prototype stores reports for your account but does not send them to a provider.</p><h3>3. Follow your progress</h3><p>Your provider reviews the issue and decides on next steps. This portal does not change your prescription.</p></div><p className="demo-note">Report history is saved locally in the development database; provider messages and status updates are not connected.</p></section></div>}
  </div>
}
export default App
