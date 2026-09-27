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
