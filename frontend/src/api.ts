export type PatientProfile = {
  id: number
  name: string
  email: string
  date_of_birth: string | null
}

export type Prescription = {
  id: string
  medication: string
  instructions: string
  active: boolean
  provider: string
  pharmacy: string
}

export type OpenReport = {
  id: number
  patient_id: number
  patient_name: string
  prescription_id: number
  medication: string
  original_prescription: PrescriptionSnapshot
  issue: string
  status: string
  created_at: string
}

export type PrescriptionSnapshot = {
  id: number
  medication: string
  dosage: string | null
  instructions: string | null
  active: boolean
}

export type CreatedPrescription = PrescriptionSnapshot & {
  patient_id: number
}

export type ReplacementOption = {
  sponsorship: 'sponsored' | 'non-sponsored'
  key: string
  medication: string
  dosage: string
  instructions: string
}

export type DocUpdatePatient = {
  id: number
  name: string
  email: string
}

export type PatientAuditEntry = {
  id: number
  patient_id: number
  actor_source: string
  action: string
  entity_type: string
  entity_id: number | null
  changes: Record<string, unknown>
  created_at: string
}

// /api is forwarded to FastAPI by the local Vite proxy.
async function requestJson(path: string, options?: RequestInit): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, options)
  } catch (error) {
    if (options?.signal?.aborted) throw error
    throw new Error('Cannot reach the backend. Check that FastAPI is running, then try again.')
  }
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : null
    if (typeof detail === 'string') throw new Error(detail)
    if (Array.isArray(detail)) {
      throw new Error(detail.map(item => `${Array.isArray(item.loc) ? item.loc.slice(1).join(' ').replaceAll('_', ' ') : 'Input'}: ${item.msg || 'Invalid value'}`).join(' '))
    }
    throw new Error('The server could not complete this request. Please try again.')
  }
  return body
}

export async function authenticatePatient(mode: 'login' | 'signup', values: {
  name: string; birth: string; email: string; password: string
}): Promise<PatientProfile> {
  const body = mode === 'login'
    ? { email: values.email.trim(), password: values.password }
    : { name: values.name.trim(), email: values.email.trim(), password: values.password, date_of_birth: values.birth }
  const result = await requestJson(mode === 'login' ? '/patients/login' : '/patients', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'number' ||
      !Number.isInteger(result.id) || result.id <= 0 || !('name' in result) || typeof result.name !== 'string' ||
      !('email' in result) || typeof result.email !== 'string' || !('date_of_birth' in result) ||
      (result.date_of_birth !== null && typeof result.date_of_birth !== 'string')) {
    throw new Error('The server returned an invalid patient profile. If signing up, your account may already have been created; try logging in.')
  }
  return result as PatientProfile
}

export async function loadPrescriptions(patientId: number, signal?: AbortSignal): Promise<Prescription[]> {
  const result = await requestJson(`/prescriptions/${patientId}`, { signal })
  if (!Array.isArray(result)) throw new Error('The server returned an invalid prescription list.')
  return result.map(record => {
    if (!record || typeof record.id !== 'number' || !Number.isInteger(record.id) || record.id <= 0 ||
        record.patient_id !== patientId || typeof record.medication !== 'string' || typeof record.active !== 'boolean' ||
        (record.dosage != null && typeof record.dosage !== 'string') ||
        (record.instructions != null && typeof record.instructions !== 'string')) {
      throw new Error('The server returned an invalid prescription record. Please try again.')
    }
    return {
      id: String(record.id),
      medication: [record.medication, record.dosage].filter(Boolean).join(' · '),
      instructions: record.instructions || '', active: record.active,
      // The current API does not return provider or pharmacy details.
      provider: 'Not provided', pharmacy: 'Not provided',
    }
  })
}

export async function loadPatientAuditLog(patientId: number, signal?: AbortSignal): Promise<PatientAuditEntry[]> {
  const result = await requestJson(`/patients/${patientId}/audit-log`, { signal })
  if (!Array.isArray(result)) throw new Error('The server returned an invalid audit log.')
  return result.map(entry => {
    if (!entry || typeof entry !== 'object' || typeof entry.id !== 'number' ||
        !Number.isInteger(entry.id) || entry.patient_id !== patientId ||
        typeof entry.actor_source !== 'string' || typeof entry.action !== 'string' ||
        typeof entry.entity_type !== 'string' ||
        (entry.entity_id !== null && typeof entry.entity_id !== 'number') ||
        !entry.changes || typeof entry.changes !== 'object' || Array.isArray(entry.changes) ||
        typeof entry.created_at !== 'string') {
      throw new Error('The server returned an invalid audit entry.')
    }
    return entry as PatientAuditEntry
  })
}

export async function getReportResetEnabled(signal?: AbortSignal): Promise<boolean> {
  const result = await requestJson('/reports/developer/status', { signal })
  return !!result && typeof result === 'object' && 'report_reset_enabled' in result && result.report_reset_enabled === true
}

export async function resetPatientReports(patientId: number): Promise<number> {
  const result = await requestJson(`/reports/developer/${patientId}`, { method: 'DELETE' })
  if (!result || typeof result !== 'object' || !('patient_id' in result) || result.patient_id !== patientId ||
      !('deleted_count' in result) || typeof result.deleted_count !== 'number' || !Number.isInteger(result.deleted_count) || result.deleted_count < 0) {
    throw new Error('The server returned an unexpected reset response. Refresh to check your report history.')
  }
  return result.deleted_count
}

export async function loadOpenReports(signal?: AbortSignal): Promise<OpenReport[]> {
  const result = await requestJson('/reports/open', { signal })
  if (!Array.isArray(result)) throw new Error('The server returned an invalid request list.')
  return result.map(record => {
    if (!record || typeof record !== 'object' ||
        typeof record.id !== 'number' || !Number.isInteger(record.id) ||
        typeof record.patient_id !== 'number' || !Number.isInteger(record.patient_id) ||
        typeof record.patient_name !== 'string' ||
        typeof record.prescription_id !== 'number' || !Number.isInteger(record.prescription_id) ||
        typeof record.medication !== 'string' || typeof record.issue !== 'string' ||
        !isPrescriptionSnapshot(record.original_prescription) ||
        typeof record.status !== 'string' || typeof record.created_at !== 'string') {
      throw new Error('The server returned an invalid open request.')
    }
    return record as OpenReport
  })
}

function isPrescriptionSnapshot(value: unknown): value is PrescriptionSnapshot {
  return !!value && typeof value === 'object' &&
    'id' in value && typeof value.id === 'number' && Number.isInteger(value.id) &&
    'medication' in value && typeof value.medication === 'string' &&
    'dosage' in value && (value.dosage === null || typeof value.dosage === 'string') &&
    'instructions' in value && (value.instructions === null || typeof value.instructions === 'string') &&
    'active' in value && typeof value.active === 'boolean'
}

export async function loadReplacementOptions(signal?: AbortSignal): Promise<ReplacementOption[]> {
  const result = await requestJson('/reports/replacement-options', { signal })
  if (!Array.isArray(result)) throw new Error('The server returned an invalid replacement list.')
  return result.map(option => {
    if (!option || typeof option !== 'object' || typeof option.key !== 'string' ||
        typeof option.medication !== 'string' || typeof option.dosage !== 'string' ||
        typeof option.instructions !== 'string' ||
        (option.sponsorship !== 'sponsored' && option.sponsorship !== 'non-sponsored')) {
      throw new Error('The server returned an invalid replacement prescription.')
    }
    return option as ReplacementOption
  })
}

export async function loadDocUpdatePatients(signal?: AbortSignal): Promise<DocUpdatePatient[]> {
  const result = await requestJson('/reports/patients', { signal })
  if (!Array.isArray(result)) throw new Error('The server returned an invalid patient list.')
  return result.map(patient => {
    if (!patient || typeof patient !== 'object' || typeof patient.id !== 'number' ||
        !Number.isInteger(patient.id) || typeof patient.name !== 'string' ||
        typeof patient.email !== 'string') {
      throw new Error('The server returned an invalid patient record.')
    }
    return patient as DocUpdatePatient
  })
}

export async function createStandalonePrescription(
  patientId: number,
  replacementKey: string,
): Promise<CreatedPrescription> {
  const result = await requestJson('/prescriptions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ patient_id: patientId, replacement_key: replacementKey }),
  })
  if (!isPrescriptionSnapshot(result) || !('patient_id' in result) ||
      typeof result.patient_id !== 'number' || result.patient_id !== patientId) {
    throw new Error('The server returned an invalid created prescription.')
  }
  return result as CreatedPrescription
}

export async function resolveOpenReport(reportId: number, replacementKey: string | null): Promise<void> {
  const result = await requestJson(`/reports/${reportId}/resolve`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ replacement_key: replacementKey }),
  })
  if (!result || typeof result !== 'object' || !('id' in result) || result.id !== reportId ||
      !('status' in result) || result.status !== 'Resolved' ||
      !('replacement_prescription' in result) ||
      (result.replacement_prescription !== null && !isPrescriptionSnapshot(result.replacement_prescription))) {
    throw new Error('The server did not confirm that the request was resolved.')
  }
}
