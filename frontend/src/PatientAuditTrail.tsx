import { useEffect, useState } from 'react'
import { loadPatientAuditLog } from './api'
import type { PatientAuditEntry } from './api'
import './PatientAuditTrail.css'

const actionLabels: Record<string, string> = {
  'patient.created': 'Patient account created',
  'report.created': 'Prescription issue reported',
  'report.resolved': 'Prescription issue resolved',
  'prescription.created': 'Prescription added',
  'reports.deleted': 'Demo reports deleted',
}

function formatValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === null || value === undefined) return 'None'
  if (Array.isArray(value)) return value.map(formatValue).join(', ')
  if (typeof value === 'object') {
    if ('from' in value && 'to' in value) {
      return `${formatValue(value.from)} → ${formatValue(value.to)}`
    }
    return Object.entries(value)
      .map(([field, fieldValue]) => `${field.replaceAll('_', ' ')}: ${formatValue(fieldValue)}`)
      .join(' · ')
  }
  return 'Unavailable'
}

function formatTimestamp(value: string): string {
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime())
    ? 'Date unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
}

export default function PatientAuditTrail({ patientId }: { patientId?: number }) {
  const [entries, setEntries] = useState<PatientAuditEntry[]>([])
  const [isLoading, setIsLoading] = useState(Boolean(patientId))
  const [error, setError] = useState('')

  useEffect(() => {
    if (patientId === undefined) return
    const controller = new AbortController()
    loadPatientAuditLog(patientId, controller.signal)
      .then(setEntries)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Unable to load patient activity.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false)
      })
    return () => controller.abort()
  }, [patientId])

  return (
    <section className="panel audit-panel" aria-labelledby="audit-title" aria-busy={isLoading}>
      <div className="section-heading">
        <div>
          <span className="eyebrow">PATIENT HISTORY</span>
          <h2 id="audit-title">Activity log</h2>
          <p>Recorded changes to this patient’s account, reports, and prescriptions.</p>
        </div>
      </div>
      {patientId === undefined ? (
        <p className="audit-empty">Activity history is available for registered patient accounts.</p>
      ) : isLoading ? (
        <p className="audit-empty" role="status">Loading activity…</p>
      ) : error ? (
        <p className="audit-error" role="alert">{error}</p>
      ) : entries.length === 0 ? (
        <p className="audit-empty">No recorded changes yet.</p>
      ) : (
        <ol className="audit-list">
          {entries.map(entry => (
            <li className="audit-entry" key={entry.id}>
              <div className="audit-entry-heading">
                <strong>{actionLabels[entry.action] ?? entry.action.replaceAll('.', ' ')}</strong>
                <time dateTime={entry.created_at}>{formatTimestamp(entry.created_at)}</time>
              </div>
              <p>{entry.entity_type.replaceAll('_', ' ')}{entry.entity_id ? ` #${entry.entity_id}` : ''} · {entry.actor_source.replaceAll('_', ' ')}</p>
              <ul>
                {Object.entries(entry.changes).map(([field, value]) => (
                  <li key={field}><span>{field.replaceAll('_', ' ')}</span><strong>{formatValue(value)}</strong></li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
