import { useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import './App.css'

type Page = 'Overview' | 'My requests' | 'My profile'
type Request = { prescriptionId?: string; provider?: string; id: string; medication: string; issue: string; pharmacy: string; date: string; status: 'Under review' | 'Prescription sent' | 'Submitted' }
type Prescription = { id: number | string; medication: string; dosage?: string | null; instructions?: string | null; active?: boolean; provider?: string; pharmacy?: string }
const initialRequests: Request[] = [
  { id: 'DU-1042', medication: 'Jardiance · 10 mg', issue: 'Not covered by insurance', pharmacy: 'Peachtree Pharmacy', date: 'Sep 24, 2026', status: 'Under review' },
  { id: 'DU-1038', medication: 'Symbicort · 80/4.5 mcg', issue: 'Medication is too expensive', pharmacy: 'Peachtree Pharmacy', date: 'Sep 18, 2026', status: 'Prescription sent' },
]
// Placeholder records for the proposed Impiricus prescription feed; never fetched patient data.
const samplePrescriptions = [
  { id: 'sample-rx-01', medication: 'Jardiance', dosage: '10 mg', provider: 'Dr. Taylor · Sample provider', pharmacy: 'Peachtree Pharmacy' },
  { id: 'sample-rx-02', medication: 'Symbicort', dosage: '80/4.5 mcg', provider: 'Dr. Taylor · Sample provider', pharmacy: 'Peachtree Pharmacy' },
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
  initialProfile: { name: string; email: string; birth: string }
  patientId?: number
  sampleRequests: boolean
  onSignOut: () => void
}

function App({ initialProfile, patientId, sampleRequests, onSignOut }: AppProps) {
  const [page, setPage] = useState<Page>('Overview')
  const [requests, setRequests] = useState<Request[]>(sampleRequests ? initialRequests : [])
  const [prescriptions, setPrescriptions] = useState<Prescription[]>(sampleRequests ? samplePrescriptions : [])
  const [prescriptionsLoading, setPrescriptionsLoading] = useState(patientId !== undefined)
  const [prescriptionError, setPrescriptionError] = useState('')
  const [creating, setCreating] = useState(false)
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<Request | null>(null)
  const [help, setHelp] = useState(false)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('All requests')
  const [profile, setProfile] = useState(initialProfile)
  const [form, setForm] = useState({ name: '', birth: '', email: '', prescriptionId: '', medication: '', issue: '', pharmacy: '', provider: '', updates: false })
  useEffect(() => {
    if (patientId === undefined) return
    let cancelled = false
    fetch(`/api/prescriptions/${patientId}`)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load your prescriptions.')
        return await response.json() as Prescription[]
      })
      .then(data => {
        if (!cancelled) setPrescriptions(data.filter(prescription => prescription.active !== false))
      })
      .catch(() => {
        if (!cancelled) setPrescriptionError('Your active prescriptions could not be loaded. Please try again later.')
      })
      .finally(() => {
        if (!cancelled) setPrescriptionsLoading(false)
      })
    return () => { cancelled = true }
  }, [patientId])
  useEffect(() => {
    if (!creating && !selected && !help) return
    const previous = document.activeElement as HTMLElement | null
    const oldOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const dialog = document.querySelector<HTMLElement>('[role=dialog]')
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button, input, select, [tabindex="0"]') || [])
    focusable()[0]?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setCreating(false); setSelected(null); setHelp(false) }
      if (e.key === 'Tab') {
        const elements = focusable(), first = elements[0], last = elements[elements.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [creating, selected, help])
  function startRequest() { setStep(0); setCreating(true); setNotice(''); setForm({ name: profile.name, birth: profile.birth, email: profile.email, prescriptionId: '', medication: '', issue: '', pharmacy: '', provider: '', updates: false }) }
  function reportPrescription(prescription: Prescription) {
    setStep(1)
    setNotice('')
    setForm({ name: profile.name, birth: profile.birth, email: profile.email, prescriptionId: String(prescription.id), medication: [prescription.medication, prescription.dosage].filter(Boolean).join(' · '), issue: '', pharmacy: prescription.pharmacy || '', provider: prescription.provider || '', updates: false })
    setCreating(true)
  }
  function submit(e: FormEvent) {
    e.preventDefault()
    if (step > 0 && !prescriptions.some(prescription => String(prescription.id) === form.prescriptionId)) return
    if (step < 2) { setStep(step + 1); return }
    const request: Request = { prescriptionId: form.prescriptionId, provider: form.provider, id: `DU-${1043 + requests.length}`, medication: form.medication, issue: form.issue, pharmacy: form.pharmacy, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), status: 'Submitted' }
    setRequests([request, ...requests]); setCreating(false); setPage('My requests'); setNotice(`Demo request ${request.id} created. No information has been sent to a provider.`)
  }
  const field = (key: 'name' | 'birth' | 'email', label: string, placeholder = '', type = 'text', required = true) => <label>{label}<input type={type} max={type === 'date' ? new Date().toISOString().slice(0, 10) : undefined} required={required} value={form[key]} placeholder={placeholder} onChange={e => setForm({ ...form, [key]: e.target.value })}/></label>
  const pending = requests.filter(r => r.status !== 'Prescription sent').length
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('Overview') }}><span className="brand-mark"><Icon name="plus" size={26}/></span>Rx<span>Rescue</span><i/></a>
      <div className="portal-label">PATIENT PORTAL</div>
      <nav aria-label="Main navigation">{(['Overview', 'My requests', 'My profile'] as Page[]).map((item, i) => <button key={item} className={page === item ? 'nav-item active' : 'nav-item'} onClick={() => setPage(item)}><Icon name={['grid', 'file', 'user'][i]}/>{item}{item === 'My requests' && <span className="nav-count">{requests.length}</span>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="support-card"><span className="support-icon"><Icon name="help"/></span><h3>A little help along the way.</h3><p>Learn what happens after you send a request.</p><button className="text-button" onClick={() => setHelp(true)}>Visit help center <Icon name="arrow" size={16}/></button></div><div className="sidebar-user"><span className="avatar">{profile.name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase()}</span><div><strong>{profile.name}</strong><small>Personal account</small></div><button aria-label="Open profile" onClick={() => setPage('My profile')}>↗</button></div><button className="sign-out" onClick={onSignOut}>Sign out of preview</button></div>
    </aside>
    <div className="workspace"><header className="topbar"><div>My care <span>/</span> <strong>{page}</strong></div><span className="demo-tag">Demo workspace</span></header>
    <main>
      <div className="page-heading"><div><div className="eyebrow">YOUR HEALTH, A LITTLE SIMPLER</div><h1>{page === 'Overview' ? `Welcome back, ${profile.name.split(' ')[0]}.` : page}</h1><p>{page === 'Overview' ? 'Let’s get your prescription moving in the right direction.' : page === 'My requests' ? 'Follow your requests, from the first step to your pharmacy.' : 'Keep your contact information up to date.'}</p></div><div className="date-label">Patient care, connected <span className="green-dot"/></div></div>
      {notice && <div className="notice" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
      {page === 'Overview' && <>
        <section className="hero"><div className="hero-copy"><span className="hero-tag"><span/> A clearer path to your prescription</span><h2>Your medication.<br/>More within reach.</h2><p>Too expensive, not covered, or a medical conflict?<br className="desktop-break"/> Report the problem for review.</p><button className="primary" onClick={startRequest}><Icon name="plus" size={18}/> Report a problem <Icon name="arrow" size={18}/></button><small>Just a few minutes to get started.</small></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="floating-plus">+</div><div className="rx-card"><span className="rx-symbol">℞</span><div className="art-line long"/><div className="art-line"/><div className="art-med"><span className="capsule"/><div><div className="art-line long"/><div className="art-line"/></div></div><span className="art-card-check"><Icon name="check" size={16}/> Connected to your care</span></div><div className="art-badge"><span><Icon name="check" size={23}/></span>One step closer<br/><strong>to feeling better.</strong></div></div></section>
        <section className="stats" aria-label="Request summary">{[{ title: 'Total requests', value: requests.length, sub: 'Your care, all in one place', icon: 'file', color: 'blue' }, { title: 'Awaiting provider', value: pending, sub: 'We’ll keep you in the loop', icon: 'clock', color: 'amber' }, { title: 'Prescription sent', value: requests.length - pending, sub: 'Check with your pharmacy', icon: 'check', color: 'green' }].map(s => <div className="stat" key={s.title}><span className={`stat-icon ${s.color}`}><Icon name={s.icon}/></span><div><span>{s.title}</span><strong>{s.value}</strong><small>{s.sub}</small></div></div>)}</section>
        <section className="panel active-prescriptions"><div className="section-heading"><div><h2>Active prescriptions</h2><p>Select a prescription to report a problem.</p></div></div>{prescriptionsLoading ? <p className="prescription-state">Loading your prescriptions…</p> : prescriptionError ? <p className="prescription-state" role="alert">{prescriptionError}</p> : prescriptions.length === 0 ? <p className="prescription-state">No active prescriptions on file.</p> : <div className="prescription-list">{prescriptions.map(prescription => <button className="prescription-row" key={prescription.id} onClick={() => reportPrescription(prescription)}><span className="med-icon"><Icon name="pill" size={23}/></span><span className="prescription-info"><strong>{prescription.medication}{prescription.dosage ? ` · ${prescription.dosage}` : ''}</strong>{prescription.instructions && <small>{prescription.instructions}</small>}</span><span className="report-link">Report a problem <Icon name="arrow" size={16}/></span></button>)}</div>}</section>
      </>}
      {page !== 'My profile' ? <div className={page === 'Overview' ? 'content-grid' : ''}><section className="panel requests-panel"><div className="section-heading"><div><h2>{page === 'Overview' ? 'Recent requests' : 'Your requests'}</h2><p>A little progress, a little peace of mind.</p></div>{page === 'Overview' ? <button className="text-button" onClick={() => setPage('My requests')}>View all <Icon name="arrow" size={16}/></button> : <button className="primary" onClick={startRequest}><Icon name="plus" size={16}/> Report a problem</button>}</div>{page === 'My requests' && <div className="filters">{['All requests', 'Awaiting provider', 'Prescription sent'].map(f => <button key={f} className={filter === f ? 'selected' : ''} onClick={() => setFilter(f)}>{f}</button>)}</div>}<div className="request-list">{requests.length === 0 && <div className="empty-requests"><h3>Your next step starts here.</h3><p>No requests yet. Choose an existing prescription to report a problem.</p><button className="primary" onClick={startRequest}>Report a problem</button></div>}{requests.filter(r => page === 'Overview' || filter === 'All requests' || (filter === 'Awaiting provider' ? r.status !== 'Prescription sent' : r.status === filter)).slice(0, page === 'Overview' ? 3 : undefined).map(r => <button className="request-row" key={r.id} onClick={() => setSelected(r)}><span className="med-icon"><Icon name="pill" size={23}/></span><div className="request-info"><strong>{r.medication}</strong><span>{r.issue}</span><small>{r.id} <b>·</b> {r.date}</small></div><div className="request-end"><span className={`status ${r.status === 'Prescription sent' ? 'sent' : 'pending'}`}><span/>{r.status}</span><span className="detail-link">View details ↗</span></div></button>)}</div><div className="panel-foot"><Icon name="shield" size={15}/> Sample data for preview. New requests reset when you refresh.</div></section>
      {page === 'Overview' && <section className="panel how-panel"><span className="eyebrow">HERE FOR EVERY STEP</span><h2>A simpler way forward.</h2><div className="steps">{[['Tell us what’s getting in the way', 'Choose a prescription and tell us the issue.'], ['Your provider takes a look', 'They review your request and options.'], ['Your next step, delivered', 'Track updates right here in your portal.']].map(([title, desc], i) => <div className="how-step" key={title}><span>{i + 1}</span><div><h3>{title}</h3><p>{desc}</p></div></div>)}</div><button className="text-button" onClick={() => setHelp(true)}>How it works <Icon name="arrow" size={16}/></button></section>}</div> : <section className="panel profile-panel"><h2>Personal information</h2><p>Your preview details last for this session. No account has been created.</p><form onSubmit={e => { e.preventDefault(); setNotice('Profile updated for this demo session.') }}><label>Full name<input required value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}/></label><label>Email address<input required type="email" value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })}/></label><label>Date of birth<input required type="date" max={new Date().toISOString().slice(0, 10)} value={profile.birth} onChange={e => setProfile({ ...profile, birth: e.target.value })}/></label><button className="primary">Save changes</button></form></section>}
      <footer><span className="footer-brand">RxRescue</span><span>A better connection to your care.</span><button onClick={() => setHelp(true)}>Questions? We’re here to help <Icon name="arrow" size={14}/></button></footer>
    </main></div>
    {creating && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="request-title"><button className="close" aria-label="Close request form" onClick={() => setCreating(false)}>×</button><span className="eyebrow">LET’S TAKE THE NEXT STEP</span><h2 id="request-title">Report a prescription problem</h2><p className="demo-note">Interactive demo — use sample information only. Nothing is sent to a provider.</p><div className="form-progress">{['Your details', 'Your prescription', 'Review'].map((s, i) => <span className={i <= step ? 'current' : ''} key={s}>{i + 1}. {s}</span>)}</div><form onSubmit={submit}>
      {step === 0 && <div className="form-fields">{field('name', 'Full name')}{field('birth', 'Date of birth', '', 'date')}{field('email', 'Email address', '', 'email')}</div>}
      {step === 1 && <div className="form-fields">
        <p className="demo-note">In the connected portal, your existing prescriptions would come from Impiricus. These records are samples for the preview.</p>
        {prescriptions.length === 0 ? <div className="empty-requests"><h3>No prescriptions connected yet.</h3><p>Your new preview profile has no prescription records. Load sample prescriptions to try this step.</p><button type="button" className="secondary" onClick={() => setPrescriptions(samplePrescriptions)}>Load sample prescriptions</button></div> : <>
          <label>Which prescription are you having an issue with?<select required value={form.prescriptionId} onChange={e => {
            const prescription = prescriptions.find(item => item.id === e.target.value)
            setForm({ ...form, prescriptionId: prescription ? String(prescription.id) : '', medication: prescription?.medication || '', provider: prescription?.provider || '', pharmacy: prescription?.pharmacy || '' })
          }}><option value="">Choose an existing prescription</option>{prescriptions.map(prescription => <option key={prescription.id} value={prescription.id}>{prescription.medication}</option>)}</select></label>
          {form.prescriptionId && <dl className="review"><div><dt>Prescribing provider</dt><dd>{form.provider}</dd></div><div><dt>Pharmacy on record</dt><dd>{form.pharmacy}</dd></div></dl>}
          <label>What’s the issue?<select required value={form.issue} onChange={e => setForm({ ...form, issue: e.target.value })}><option value="">Select an issue</option><option>Too expensive</option><option>No insurance coverage</option><option>Medical conflicts</option></select></label>
          <p className="muted">You don’t need to enter a medication name or strength. Your selection identifies the existing prescription for provider review.</p>
        </>}
      </div>}
      {step === 2 && <><dl className="review">{[['Patient', form.name], ['Selected prescription', form.medication], ['Issue', form.issue], ['Provider', form.provider], ['Pharmacy', form.pharmacy]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl><label className="checkbox"><input type="checkbox" checked={form.updates} onChange={e => setForm({ ...form, updates: e.target.checked })}/>Email me when my request status changes (demo only).</label><p className="muted">Your provider reviews the reported issue and decides on next steps.</p></>}
      <div className="modal-actions"><button type="button" className="secondary" onClick={() => step > 0 ? setStep(step - 1) : setCreating(false)}>{step > 0 ? 'Back' : 'Cancel'}</button><button className="primary" type="submit" disabled={step === 1 && prescriptions.length === 0}>{step === 2 ? 'Submit report' : 'Continue'}<Icon name="arrow" size={16}/></button></div></form></section></div>}
    {selected && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="detail-title"><button className="close" aria-label="Close request details" onClick={() => setSelected(null)}>×</button><span className="eyebrow">REQUEST {selected.id}</span><h2 id="detail-title">{selected.medication}</h2><p>{selected.issue}</p><div className="tracking">{['Submitted', 'Under review', 'Prescription sent'].map((s, i) => <div className={i <= ['Submitted', 'Under review', 'Prescription sent'].indexOf(selected.status) ? 'complete' : ''} key={s}><span><Icon name={i <= ['Submitted', 'Under review', 'Prescription sent'].indexOf(selected.status) ? 'check' : 'clock'} size={18}/></span><strong>{s}</strong></div>)}</div><dl className="review"><div><dt>Pharmacy</dt><dd>{selected.pharmacy}</dd></div>{selected.provider && <div><dt>Prescribing provider</dt><dd>{selected.provider}</dd></div>}<div><dt>Requested</dt><dd>{selected.date}</dd></div></dl><p className="demo-note">Demo status only. No provider has been contacted and no prescription has been issued by this portal.</p><button className="primary" onClick={() => setSelected(null)}>Back to my requests</button></section></div>}
    {help && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="close" aria-label="Close help" onClick={() => setHelp(false)}>×</button><span className="eyebrow">A LITTLE GUIDANCE</span><h2 id="help-title">From report to review.</h2><div className="help-content"><h3>1. Share your medication issue</h3><p>Choose an existing prescription and tell us what is getting in the way. The prescription details are included for provider review.</p><h3>2. Review your report</h3><p>Check the selected prescription and issue before submitting. In the proposed workflow, the report is routed to your provider through DocUpdate.</p><h3>3. Follow your progress</h3><p>Your provider reviews the issue and decides on next steps. This portal does not change your prescription.</p></div><p className="demo-note">This frontend preview is not connected to clinical services. Report submission, status updates, and email delivery are demonstrations.</p></section></div>}
  </div>
}
export default App
