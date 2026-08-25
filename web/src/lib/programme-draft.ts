export const PROGRAMME_DRAFT_VERSION = 1
export const PROGRAMME_DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000

export type ProgrammeDraftSubject = {
  clientId: string
  id?: string
  name: string
  description: string
  tutorIds: string[]
}

export type ProgrammeDraftData = {
  name: string
  description: string
  price: string
  subjects: ProgrammeDraftSubject[]
  coverFileName?: string
  step: number
}

type StoredProgrammeDraft = {
  version: number
  savedAt: number
  data: ProgrammeDraftData
}

export function programmeDraftKey(schoolId: string, profileId: string, programmeId = 'new') {
  return `kanvise:programme-builder:v${PROGRAMME_DRAFT_VERSION}:${schoolId}:${profileId}:${programmeId}`
}

export function saveProgrammeDraft(
  schoolId: string,
  profileId: string,
  data: ProgrammeDraftData,
  programmeId = 'new',
  storage: Pick<Storage, 'setItem'> = window.localStorage,
  now = Date.now(),
) {
  storage.setItem(programmeDraftKey(schoolId, profileId, programmeId), JSON.stringify({
    version: PROGRAMME_DRAFT_VERSION,
    savedAt: now,
    data,
  } satisfies StoredProgrammeDraft))
}

export function loadProgrammeDraft(
  schoolId: string,
  profileId: string,
  programmeId = 'new',
  storage: Pick<Storage, 'getItem' | 'removeItem'> = window.localStorage,
  now = Date.now(),
) {
  const key = programmeDraftKey(schoolId, profileId, programmeId)
  const raw = storage.getItem(key)
  if (!raw) return null
  try {
    const value = JSON.parse(raw) as StoredProgrammeDraft
    if (value.version !== PROGRAMME_DRAFT_VERSION || now - value.savedAt > PROGRAMME_DRAFT_TTL_MS) {
      storage.removeItem(key)
      return null
    }
    return value
  } catch {
    storage.removeItem(key)
    return null
  }
}

export function clearProgrammeDraft(
  schoolId: string,
  profileId: string,
  programmeId = 'new',
  storage: Pick<Storage, 'removeItem'> = window.localStorage,
) {
  storage.removeItem(programmeDraftKey(schoolId, profileId, programmeId))
}
