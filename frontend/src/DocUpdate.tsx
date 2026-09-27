import { useEffect, useState } from 'react'
import { loadOpenReports, resolveOpenReport } from './api'
import type { OpenReport } from './api'
import './DocUpdate.css'

function formatCreatedAt(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

export default function DocUpdate() {
  const [reports, setReports] = useState<OpenReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [resolvingId, setResolvingId] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    loadOpenReports(controller.signal)
      .then(setReports)
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

  async function resolve(report: OpenReport) {
    setResolvingId(report.id)
    setError('')
    setNotice('')
    try {
      await resolveOpenReport(report.id)
      setReports(current => current.filter(item => item.id !== report.id))
      setNotice(`Request DU-${report.id} marked resolved.`)
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
          <button className="docupdate-refresh" type="button" onClick={refreshQueue} disabled={isLoading}>
            Refresh queue
          </button>
        </div>

        <div className="docupdate-summary" aria-live="polite">
          <span className="docupdate-live-dot" />
          {isLoading ? 'Loading requests' : `${reports.length} open ${reports.length === 1 ? 'request' : 'requests'}`}
        </div>

        {notice && <p className="docupdate-notice" role="status">{notice}</p>}
        {error && <p className="docupdate-error" role="alert">{error}</p>}
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
                  <th scope="col">Prescription</th>
                  <th scope="col">Issue</th>
                  <th scope="col">Submitted</th>
                  <th scope="col"><span className="visually-hidden">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {reports.map(report => (
                  <tr key={report.id}>
                    <td className="docupdate-id">DU-{report.id}</td>
                    <td>{report.patient_name}<small>Patient {report.patient_id}</small></td>
                    <td>{report.medication}</td>
                    <td>{report.issue}<small>{report.status}</small></td>
                    <td>{formatCreatedAt(report.created_at)}</td>
                    <td>
                      <button
                        className="docupdate-resolve"
                        type="button"
                        onClick={() => resolve(report)}
                        disabled={resolvingId !== null}
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