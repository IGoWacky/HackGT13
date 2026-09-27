import { useEffect, useState } from 'react'
import { createStandalonePrescription, loadDocUpdatePatients, loadOpenReports, loadReplacementOptions, resolveOpenReport } from './api'
import type { DocUpdatePatient, OpenReport, ReplacementOption } from './api'
import './DocUpdate.css'

function formatCreatedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function DocUpdate() {
  const [reports, setReports] = useState<OpenReport[]>([])
  const [replacementOptions, setReplacementOptions] = useState<ReplacementOption[]>([])
  const [patients, setPatients] = useState<DocUpdatePatient[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Record<number, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [showStandaloneForm, setShowStandaloneForm] = useState(false)
  const [standalonePatientId, setStandalonePatientId] = useState('')
  const [standaloneOptionKey, setStandaloneOptionKey] = useState('')
  const [isCreatingPrescription, setIsCreatingPrescription] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      loadOpenReports(controller.signal),
      loadReplacementOptions(controller.signal),
      loadDocUpdatePatients(controller.signal),
    ])
      .then(([openReports, options, patientOptions]) => {
        setReports(openReports)
        setReplacementOptions(options)
        setPatients(patientOptions)
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load open requests.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [refreshKey])

  function refreshQueue() {
    setIsLoading(true)
    setError('')
    setNotice('')
    setRefreshKey(value => value + 1)
  }

  function openStandaloneForm() {
    setError('')
    setNotice('')
    setStandalonePatientId('')
    setStandaloneOptionKey('')
    setShowStandaloneForm(true)
  }

  async function createStandalone() {
    const patientId = Number(standalonePatientId)
    if (!patientId || !standaloneOptionKey) return

    setIsCreatingPrescription(true)
    setError('')
    setNotice('')
    try {
      const prescription = await createStandalonePrescription(patientId, standaloneOptionKey)
      const patient = patients.find(item => item.id === prescription.patient_id)
      setShowStandaloneForm(false)
      setNotice(`Created ${prescription.medication} for ${patient?.name ?? 'the selected patient'}. No report was created.`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to create the prescription.')
    } finally {
      setIsCreatingPrescription(false)
    }
  }

  async function resolve(report: OpenReport) {
    setResolvingId(report.id)
    setError('')
    setNotice('')
    try {
      const replacementKey = selectedOptions[report.id]
      if (!replacementKey) throw new Error('Select a synthetic replacement prescription first.')
      await resolveOpenReport(report.id, replacementKey)
      setReports(current => current.filter(item => item.id !== report.id))
      setSelectedOptions(current => {
        const next = { ...current }
        delete next[report.id]
        return next
      })
      setNotice(`Request DU-${report.id} resolved with a new synthetic prescription.`)
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : 'Unable to resolve this request.')
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <main className="docupdate-page">
      <header className="docupdate-header">
        <a className="docupdate-brand" href="/">RxRescue</a>
        <span>DOCUPDATE <i /> CLINICIAN WORKQUEUE</span>
      </header>
      <section className="docupdate-content" aria-labelledby="docupdate-title">
        <div className="docupdate-heading">
          <div>
            <p className="docupdate-eyebrow">PRESCRIPTION SUPPORT</p>
            <h1 id="docupdate-title">Open requests</h1>
            <p className="docupdate-description">Review patient-submitted prescription issues and mark them resolved.</p>
          </div>
          <div className="docupdate-actions">
            <button className="docupdate-create" type="button" onClick={openStandaloneForm} disabled={isLoading || patients.length === 0}>
              New prescription
            </button>
            <button className="docupdate-refresh" type="button" onClick={refreshQueue} disabled={isLoading}>
              Refresh queue
            </button>
          </div>
        </div>

        <div className="docupdate-summary" aria-live="polite">
          <span className="docupdate-live-dot" />
          {isLoading ? 'Loading requests' : `${reports.length} open ${reports.length === 1 ? 'request' : 'requests'}`}
        </div>

        {notice && <p className="docupdate-notice" role="status">{notice}</p>}
        {error && <p className="docupdate-error" role="alert">{error}</p>}
        {showStandaloneForm && (
          <form className="docupdate-create-panel" onSubmit={event => { event.preventDefault(); void createStandalone() }}>
            <div className="docupdate-create-heading">
              <div>
                <p className="docupdate-eyebrow">NO REPORT REQUIRED</p>
                <h2>Create a prescription</h2>
                <p>Attach a clearly synthetic sample prescription directly to a patient.</p>
              </div>
              <button className="docupdate-cancel" type="button" onClick={() => setShowStandaloneForm(false)} disabled={isCreatingPrescription}>Cancel</button>
            </div>
            <div className="docupdate-form-fields">
              <label>
                Patient
                <select required value={standalonePatientId} onChange={event => setStandalonePatientId(event.target.value)} disabled={isCreatingPrescription}>
                  <option value="">Choose a patient</option>
                  {patients.map(patient => <option key={patient.id} value={patient.id}>{patient.name} · {patient.email}</option>)}
                </select>
              </label>
              <label>
                Synthetic sample prescription
                <select required value={standaloneOptionKey} onChange={event => setStandaloneOptionKey(event.target.value)} disabled={isCreatingPrescription}>
                  <option value="">Choose a sample</option>
                  {replacementOptions.map(option => <option key={option.key} value={option.key}>{option.medication} · {option.dosage}</option>)}
                </select>
              </label>
            </div>
            {standaloneOptionKey && (() => {
              const option = replacementOptions.find(item => item.key === standaloneOptionKey)
              return option ? <p className="docupdate-prescription-preview"><strong>{option.dosage}</strong><span>{option.instructions}</span></p> : null
            })()}
            <p className="docupdate-synthetic-note">Synthetic demo data only. This action creates a prescription record but no request, report, or clinical recommendation.</p>
            <button className="docupdate-resolve" type="submit" disabled={isCreatingPrescription || !standalonePatientId || !standaloneOptionKey}>
              {isCreatingPrescription ? 'Creating…' : 'Create prescription'}
            </button>
          </form>
        )}
        {isLoading ? (
          <p className="docupdate-state" role="status">Loading open requests…</p>
        ) : error && reports.length === 0 ? (
          <div className="docupdate-empty">
            <h2>Requests unavailable</h2>
            <p>Check the API connection, then try loading the queue again.</p>
            <button className="docupdate-refresh" type="button" onClick={refreshQueue}>Try again</button>
          </div>
        ) : reports.length === 0 ? (
          <div className="docupdate-empty">
            <h2>Queue is clear</h2>
            <p>There are no open prescription requests right now.</p>
          </div>
        ) : (
          <div className="docupdate-table-wrap">
            <table className="docupdate-table">
              <thead>
                <tr>
                  <th scope="col">Request</th>
                  <th scope="col">Patient</th>
                  <th scope="col">Original prescription</th>
                  <th scope="col">Issue</th>
                  <th scope="col">Submitted</th>
                  <th scope="col">Synthetic replacement</th>
                  <th scope="col"><span className="visually-hidden">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report.id}>
                    <td className="docupdate-id">DU-{report.id}</td>
                    <td>{report.patient_name}<small>Patient {report.patient_id}</small></td>
                    <td>{report.original_prescription.medication}<small>{report.original_prescription.dosage || 'Dosage not recorded'}</small><small>{report.original_prescription.instructions || 'Instructions not recorded'}</small></td>
                    <td>{report.issue}<small>{report.status}</small></td>
                    <td>{formatCreatedAt(report.created_at)}</td>
                    <td>
                      <select
                        className="docupdate-select"
                        aria-label={`Synthetic replacement for request DU-${report.id}`}
                        value={selectedOptions[report.id] || ''}
                        onChange={event => setSelectedOptions(current => ({ ...current, [report.id]: event.target.value }))}
                        disabled={resolvingId !== null}
                      >
                        <option value="">Choose a sample</option>
                        {replacementOptions.map(option => (
                          <option key={option.key} value={option.key}>
                            {option.medication} · {option.dosage}
                          </option>
                        ))}
                      </select>
                      {selectedOptions[report.id] && <small className="docupdate-option-detail">
                        {replacementOptions.find(option => option.key === selectedOptions[report.id])?.instructions}
                      </small>}
                    </td>
                    <td>
                      <button
                        className="docupdate-resolve"
                        type="button"
                        onClick={() => resolve(report)}
                        disabled={resolvingId !== null || !selectedOptions[report.id]}
                        aria-label={`Resolve request DU-${report.id}`}
                      >
                        {resolvingId === report.id ? 'Resolving…' : 'Resolve'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="docupdate-disclaimer">Demo work queue. Staff authentication and clinical decision workflows are not implemented.</p>
      </section>
    </main>
  )
}