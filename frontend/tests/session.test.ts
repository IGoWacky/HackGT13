import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clearPortalSession, readPortalSession, savePortalSession } from '../src/session.ts'
const account = { patientId: 7, sampleRequests: false, profile: { name: 'Test Patient', email: 'test@example.com', birth: '1995-01-02' } }
function storage() {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
}
test('refresh restores the account and patient ID', () => {
  const tab = storage()
  assert.equal(savePortalSession(account, tab), true)
  assert.deepEqual(readPortalSession(tab), account)
  assert.deepEqual(readPortalSession(tab), account)
})
test('sign-out prevents restoration on the next refresh', () => {
  const tab = storage()
  savePortalSession(account, tab)
  clearPortalSession(tab)
  assert.equal(readPortalSession(tab), null)
})
test('passwords and reports are never serialized even if extra values are supplied', () => {
  const tab = storage()
  savePortalSession({ ...account, ...{ password: 'do-not-store', confirm: 'do-not-store', reports: ['old report'] } }, tab)
  const saved = [...tab.values.values()][0]
  assert.ok(!saved.includes('password') && !saved.includes('confirm') && !saved.includes('report') && !saved.includes('do-not-store'))
})
test('switching accounts replaces the previous identity', () => {
  const tab = storage()
  savePortalSession(account, tab)
  savePortalSession({ ...account, patientId: 8 }, tab)
  assert.equal(readPortalSession(tab)?.patientId, 8)
})
test('demo is restored without retaining an actual patient ID', () => {
  const tab = storage()
  savePortalSession(account, tab)
  savePortalSession({ ...account, sampleRequests: true }, tab)
  assert.equal(readPortalSession(tab)?.sampleRequests, true)
  assert.equal(readPortalSession(tab)?.patientId, undefined)
})
test('malformed or incompatible data does not crash login', () => {
  const tab = storage()
  for (const value of ['{bad', 'null', JSON.stringify({ version: 99, kind: 'patient' }), JSON.stringify({ version: 1, kind: 'patient', patientId: -1, profile: account.profile })]) {
    tab.setItem('rxrescue.portal-session.v1', value)
    assert.equal(readPortalSession(tab), null)
  }
})
test('blocked storage does not crash login or sign-out', () => {
  const blocked = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') }, removeItem() { throw new Error('blocked') } }
  assert.equal(readPortalSession(blocked), null)
  assert.equal(savePortalSession(account, blocked), false)
  assert.doesNotThrow(() => clearPortalSession(blocked))
})
test('a new browser tab without storage starts signed out', () => {
  assert.equal(readPortalSession(storage()), null)
})
