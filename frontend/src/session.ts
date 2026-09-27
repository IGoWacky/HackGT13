export type PortalSession = {
  profile: { name: string; email: string; birth: string }
  sampleRequests: boolean
  patientId?: number
}

const STORAGE_KEY = 'rxrescue.portal-session.v1'
const demoSession: PortalSession = {
  profile: { name: 'Alex Morgan', email: 'alex@example.com', birth: '1994-06-15' },
  sampleRequests: true,
}

type SessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): SessionStorage | undefined {
  try { return window.sessionStorage } catch { return undefined }
}

// Prototype UI continuity only: this record is not an authentication credential.
// Saved report/prescription data is always loaded from the API, never from here.
export function readPortalSession(storage = browserStorage()): PortalSession | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const record: unknown = JSON.parse(raw)
    if (!record || typeof record !== 'object' || !('version' in record) || record.version !== 1 || !('kind' in record)) return null
    if (record.kind === 'demo') return { ...demoSession, profile: { ...demoSession.profile } }
    if (record.kind !== 'patient' || !('patientId' in record) || typeof record.patientId !== 'number' ||
        !Number.isSafeInteger(record.patientId) || record.patientId <= 0 || !('profile' in record)) return null
    const profile = record.profile
    if (!profile || typeof profile !== 'object' || !('name' in profile) || typeof profile.name !== 'string' || !profile.name.trim() ||
        !('email' in profile) || typeof profile.email !== 'string' || !profile.email.trim() ||
        !('birth' in profile) || typeof profile.birth !== 'string') return null
    return {
      patientId: record.patientId, sampleRequests: false,
      profile: { name: profile.name, email: profile.email, birth: profile.birth },
    }
  } catch {
    return null
  }
}

export function savePortalSession(session: PortalSession, storage = browserStorage()): boolean {
  try {
    if (!storage) return false
    // Explicit allowlist: never serialize form values, passwords, or reports.
    const record = session.sampleRequests
      ? { version: 1, kind: 'demo' }
      : { version: 1, kind: 'patient', patientId: session.patientId,
          profile: { name: session.profile.name, email: session.profile.email, birth: session.profile.birth } }
    storage.setItem(STORAGE_KEY, JSON.stringify(record))
    return true
  } catch {
    return false
  }
}

export function clearPortalSession(storage = browserStorage()): void {
  try { storage?.removeItem(STORAGE_KEY) } catch { /* Sign-out still clears in-memory state. */ }
}
