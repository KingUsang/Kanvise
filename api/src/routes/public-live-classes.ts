import { createHash, randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { supabase } from '../lib/supabase'
import { studentHasCourseAccess } from '../lib/student-course-access'
import { createPresignedDownload, privateObjectExists } from '../storage/r2'
import { getPlugNmeetClientConfig, providerForClass } from '../plugnmeet/provider'
import { PRESENTATION_LIST_COLUMNS, publicPresentation } from '../slides/presentation-projection'
import { parseOffsetPagination } from '../lib/api-contract'
import { clientAddress, createIpRateLimiter } from '../lib/ip-rate-limit'
import { recordingLifecycle, recordingLifecycleFailure } from '../lib/recording-lifecycle'

export const publicLiveClassesRouter = new Hono()
const db = supabase as any
const cookieName = 'kanvise_live_guest'
const guestLifetimeSeconds = 12 * 60 * 60

// Admission budget for new guest sessions (DEV-LVC-010): per address (per
// process) and per class, checked before any provider token is created.
const guestAdmissionLimiter = createIpRateLimiter({ limit: 20, windowMs: 10 * 60_000 })
const MAX_ACTIVE_GUESTS_PER_CLASS = 300

const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

function writeGuestCookie(c: any, token: string) {
  setCookie(c, cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Lax', path: '/', maxAge: guestLifetimeSeconds,
  })
}

async function findClass(identifier: string) {
  if (!identifier) return null
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)
  if (!isUUID && !/^[A-Za-z0-9_-]{10,24}$/.test(identifier)) return null
  
  const query = db.from('live_classes').select('id, school_id, course_id, title, status, scheduled_at, tutor_id, teaching_mode, access_mode, share_link_revoked_at, classroom_provider, provider_room_id, school:schools(name, logo_url)')
  const { data, error } = await (isUUID ? query.eq('id', identifier) : query.eq('share_token_hash', tokenHash(identifier))).maybeSingle()
  if (error) throw error
  return data
}

function publicClassData(liveClass: any, viewer?: any) {
  // A share-link visitor should wait while the tutor's room is being prepared,
  // and should never be offered a class which is ending or unverified.
  const status = liveClass.status === 'starting' || liveClass.status === 'ready'
    ? 'scheduled'
    : liveClass.status === 'ending' || liveClass.status === 'interrupted'
      ? 'completed'
      : liveClass.status
  return {
    title: liveClass.title,
    status: liveClass.share_link_revoked_at ? 'revoked' : status,
    scheduled_at: liveClass.scheduled_at,
    centre_name: liveClass.school?.name || 'Kanvise centre',
    centre_logo_url: liveClass.school?.logo_url || null,
    access_mode: liveClass.access_mode,
    can_host: Boolean(viewer && viewer.role === 'tutor' && viewer.id === liveClass.tutor_id),
  }
}

async function currentGuest(classId: string, c: any) {
  const token = getCookie(c, cookieName)
  if (!token || !/^[A-Za-z0-9_-]{40,}$/.test(token)) return null
  const { data, error } = await db.from('live_class_guests').select('id, display_name')
    .eq('live_class_id', classId).eq('session_token_hash', tokenHash(token))
    .is('revoked_at', null).gt('expires_at', new Date().toISOString()).maybeSingle()
  if (error) throw error
  return data
}

// A dependency outage must never read as "not a member" (DEV-LVC-029).
class MemberLookupError extends Error {}

function memberLookupUnavailable(c: any) {
  return c.json({ error: 'We could not verify your access right now. Please try again shortly.', code: 'MEMBER_LOOKUP_UNAVAILABLE' }, 503)
}

async function recognisedMember(c: any, liveClass: any) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data: auth, error: authError } = await supabase.auth.getUser(header.slice(7))
  if (authError) {
    const status = (authError as any).status
    // 4xx means the token itself is invalid; anything else is an Auth outage.
    if (typeof status === 'number' && status >= 400 && status < 500) return null
    throw new MemberLookupError('auth lookup failed')
  }
  if (!auth.user) return null
  const { data, error } = await db.from('user_profiles').select('id, school_id, role, first_name, last_name, kanvise_user_id')
    .eq('supabase_auth_id', auth.user.id).eq('school_id', liveClass.school_id).maybeSingle()
  if (error) throw new MemberLookupError('profile lookup failed')
  if (!data) return null
  if (liveClass.access_mode === 'enrolled_learners') {
    if (data.role !== 'student' || !liveClass.course_id) return null
    let hasAccess: boolean
    try {
      hasAccess = await studentHasCourseAccess(data.id, liveClass.school_id, liveClass.course_id)
    } catch {
      throw new MemberLookupError('enrolment lookup failed')
    }
    if (!hasAccess) return null
  }
  return data
}

async function findClassById(classId: string) {
  if (!/^[0-9a-f-]{36}$/.test(classId) && !/^\d+$/.test(classId)) return null
  const { data, error } = await db.from('live_classes')
    .select('id, school_id, course_id, title, status, scheduled_at, tutor_id, teaching_mode, access_mode, share_token_hash, share_link_revoked_at, school:schools(name, logo_url)')
    .eq('id', classId).maybeSingle()
  if (error) throw error
  return data
}

// GET /public/live-classes/by-id/:classId — used when a visitor lands on /class/:id.
// A bare Session UUID is not a capability: the caller must present the active
// opaque share token (?share_token=) or an authenticated, authorised session.
publicLiveClassesRouter.get('/by-id/:classId', async c => {
  try {
    const liveClass = await findClassById(c.req.param('classId')!)
    const unavailable = () => c.json({ error: 'This class link is unavailable', code: 'LINK_UNAVAILABLE' }, 404)
    if (!liveClass) return unavailable()
    const presented = c.req.query('share_token') || ''
    const tokenOk = /^[A-Za-z0-9_-]{10,24}$/.test(presented) && !liveClass.share_link_revoked_at
      && liveClass.access_mode === 'anyone_with_link' && tokenHash(presented) === liveClass.share_token_hash
    const viewer = tokenOk ? null : await recognisedMember(c, liveClass)
    if (!tokenOk && !viewer) return unavailable()
    return c.json({ data: publicClassData(liveClass, viewer) })
  } catch (error) {
    if (error instanceof MemberLookupError) return memberLookupUnavailable(c)
    console.error('[public-live-class] by-id lookup failed', error)
    return c.json({ error: 'Could not load this live class', code: 'LOOKUP_FAILED' }, 500)
  }
})

publicLiveClassesRouter.get('/recordings/:token', async c => {
  try {
    const token = c.req.param('token') || ''
    if (!/^[A-Za-z0-9_-]{40,}$/.test(token)) return c.json({ error: 'Recording link unavailable', code: 'LINK_UNAVAILABLE' }, 404)
    const { data: link, error: linkError } = await db.from('live_class_recording_share_links')
      .select('live_class_id, school_id').eq('token_hash', tokenHash(token)).is('revoked_at', null).maybeSingle()
    if (linkError) return c.json({ error: 'Could not open this recording. Please try again.', code: 'RECORDING_LOOKUP_UNAVAILABLE' }, 503)
    if (!link) return c.json({ error: 'Recording link unavailable', code: 'LINK_UNAVAILABLE' }, 404)
    const [{ data: liveClass, error: classError }, { data: recordings, error: recordingError }] = await Promise.all([
      db.from('live_classes').select('id, title, scheduled_at, tutor:user_profiles!live_classes_tutor_id_fkey(first_name,last_name), course:courses!live_classes_course_id_fkey(name)').eq('id', link.live_class_id).eq('school_id', link.school_id).maybeSingle(),
      db.from('live_class_recordings').select('id, r2_file_key, content_type, status').eq('live_class_id', link.live_class_id).order('created_at', { ascending: false }).limit(10),
    ])
    if (classError || recordingError) return c.json({ error: 'Could not open this recording. Please try again.', code: 'RECORDING_LOOKUP_UNAVAILABLE' }, 503)
    if (!liveClass) return c.json({ error: 'Recording link unavailable', code: 'LINK_UNAVAILABLE' }, 404)
    // Lifecycle first, signed URL second: none, processing and failed are
    // distinct outcomes and never reach URL signing.
    const lifecycle = recordingLifecycle(recordings)
    const recording = lifecycle.ready
    if (!recording?.r2_file_key) {
      const failure = recordingLifecycleFailure(lifecycle.status === 'ready' ? 'processing' : lifecycle.status)
      return c.json({ error: failure.error, code: failure.code, recording_status: lifecycle.status === 'ready' ? 'processing' : lifecycle.status }, failure.status)
    }
    if (!(await privateObjectExists(recording.r2_file_key, String(link.school_id)))) {
      return c.json({ error: 'This recording is not available yet' }, 404)
    }
    const playbackUrl = await createPresignedDownload(recording.r2_file_key, String(link.school_id), 600)
    return c.json({ data: { recording_id: recording.id, recording_status: 'ready', playback_url: playbackUrl, playback_expires_at: new Date(Date.now() + 600_000).toISOString(), class: liveClass } })
  } catch (error) {
    console.error('[public-recording] playback failed', error)
    return c.json({ error: 'Could not open this recording', code: 'PLAYBACK_FAILED' }, 500)
  }
})

publicLiveClassesRouter.get('/:shareToken', async c => {

  try {
    const liveClass = await findClass(c.req.param('shareToken')!)
    if (!liveClass) return c.json({ error: 'This class link is unavailable', code: 'LINK_UNAVAILABLE' }, 404)
    const viewer = await recognisedMember(c, liveClass)
    return c.json({ data: publicClassData(liveClass, viewer) })
  } catch (error) {
    if (error instanceof MemberLookupError) return memberLookupUnavailable(c)
    console.error('[public-live-class] lookup failed', error)
    return c.json({ error: 'Could not load this live class', code: 'LOOKUP_FAILED' }, 500)
  }
})

// A public link is the canonical browser URL for anyone-with-link classes.
// Only the assigned tutor may promote that URL into the authenticated host
// flow; all other visitors continue using the guest join route below.
publicLiveClassesRouter.post('/:shareToken/enter', async c => {
  try {
    const liveClass = await findClass(c.req.param('shareToken')!)
    if (!liveClass || liveClass.share_link_revoked_at) return c.json({ error: 'This class link is unavailable', code: 'LINK_UNAVAILABLE' }, 404)
    if (liveClass.access_mode !== 'anyone_with_link') return c.json({ error: 'This class is for enrolled learners only', code: 'ENROLLED_ONLY' }, 403)
    const viewer = await recognisedMember(c, liveClass)
    if (!viewer || viewer.role !== 'tutor' || viewer.id !== liveClass.tutor_id) {
      return c.json({ error: 'Only the assigned tutor can enter this class as host', code: 'NOT_CLASS_TUTOR' }, 403)
    }
    return c.redirect(`/live-classes/${liveClass.id}/enter`, 307)
  } catch (error) {
    if (error instanceof MemberLookupError) return memberLookupUnavailable(c)
    console.error('[public-live-class] host entry failed', error)
    return c.json({ error: 'Could not open this class. Please try again.', code: 'HOST_ENTRY_FAILED' }, 500)
  }
})

publicLiveClassesRouter.post('/:shareToken/join', async c => {
  try {
    const liveClass = await findClass(c.req.param('shareToken')!)
    if (!liveClass || liveClass.share_link_revoked_at) return c.json({ error: 'This class link is unavailable', code: 'LINK_UNAVAILABLE' }, 404)
    // Public links are deliberately their own unauthenticated boundary. They
    // never reuse the enrolled /live-classes/:id/join route or its JWT tenant
    // middleware. An opaque share token resolves the class and its school.
    if (liveClass.access_mode !== 'anyone_with_link') return c.json({ error: 'This class is for enrolled learners only', code: 'ENROLLED_ONLY' }, 403)
    if (liveClass.status !== 'live' || !liveClass.provider_room_id || providerForClass({ accessMode: liveClass.access_mode, schoolId: liveClass.school_id, persisted: liveClass.classroom_provider }) !== 'plugnmeet') {
      return c.json({ error: liveClass.status === 'completed' ? 'This live class has ended' : 'Your tutor has not started this live class yet', code: liveClass.status === 'completed' ? 'CLASS_ENDED' : 'CLASS_NOT_LIVE' }, 409)
    }

    const body = await c.req.json().catch(() => ({}))
    const requestedName = typeof body.display_name === 'string' ? body.display_name.trim().replace(/\s+/g, ' ') : ''
    let guest = await currentGuest(liveClass.id, c)
    if (!guest) {
      if (requestedName.length < 2 || requestedName.length > 60) return c.json({ error: 'Enter a name between 2 and 60 characters', code: 'INVALID_DISPLAY_NAME' }, 400)
      const retryAfter = guestAdmissionLimiter.hit(clientAddress(c))
      if (retryAfter !== null) {
        c.header('Retry-After', String(retryAfter))
        return c.json({ error: 'Too many join attempts. Please try again shortly.', code: 'RATE_LIMITED' }, 429)
      }
      const { count: activeGuests, error: guestCountError } = await db.from('live_class_guests')
        .select('id', { count: 'exact', head: true })
        .eq('live_class_id', liveClass.id).is('revoked_at', null).gt('expires_at', new Date().toISOString())
      if (guestCountError) throw guestCountError
      if ((activeGuests ?? 0) >= MAX_ACTIVE_GUESTS_PER_CLASS) {
        return c.json({ error: 'This class has reached its guest capacity', code: 'GUEST_CAPACITY_REACHED' }, 429)
      }
      const sessionToken = randomBytes(32).toString('base64url')
      const { data, error } = await db.from('live_class_guests').insert({
        school_id: liveClass.school_id, live_class_id: liveClass.id, display_name: requestedName,
        session_token_hash: tokenHash(sessionToken), expires_at: new Date(Date.now() + guestLifetimeSeconds * 1000).toISOString(),
      }).select('id, display_name').single()
      if (error || !data) throw error || new Error('Guest session creation failed')
      guest = data
      writeGuestCookie(c, sessionToken)
    } else {
      await db.from('live_class_guests').update({ last_seen_at: new Date().toISOString() }).eq('id', guest.id)
    }
    const config = await getPlugNmeetClientConfig({
      roomId: liveClass.provider_room_id,
      userId: `guest_${guest.id}`,
      name: `(Guest) ${guest.display_name}`,
      isHost: false,
      schoolId: liveClass.school_id,
      accessMode: 'anyone_with_link',
    })
    return c.json({ data: { ...config, class_title: liveClass.title, attendance_kind: 'guest' } })
  } catch (error) {
    console.error('[public-live-class] join failed', error)
    return c.json({ error: 'Could not join this class. Please try again.', code: 'JOIN_FAILED' }, 500)
  }
})

// Guest material access deliberately uses the opaque class-browser cookie (or
// a verified member bearer token), never a raw share token alone.
publicLiveClassesRouter.get('/:shareToken/presentations', async c => {
  try {
    const liveClass = await findClass(c.req.param('shareToken')!)
    if (!liveClass || liveClass.share_link_revoked_at || liveClass.status !== 'live') return c.json({ error: 'This class is unavailable', code: 'CLASS_UNAVAILABLE' }, 404)
    const [guest, member] = await Promise.all([currentGuest(liveClass.id, c), recognisedMember(c, liveClass)])
    if (!guest && !member) return c.json({ error: 'Join this class before viewing its materials', code: 'GUEST_SESSION_REQUIRED' }, 401)
    const pagination = parseOffsetPagination(c.req.query('page'), c.req.query('page_size') ?? '100')
    if (!pagination) return c.json({ error: 'Invalid pagination parameters', code: 'INVALID_PAGINATION' }, 400)
    const { data, error } = await db.from('live_class_presentations').select(PRESENTATION_LIST_COLUMNS).eq('live_class_id', liveClass.id)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.pageSize - 1)
    if (error) throw error
    const rows: any[] = data || []
    // Only the active material carries annotations; others are omitted.
    const active = rows.find((row) => row.is_active)
    if (active) {
      const { data: withAnnotations, error: annotationError } = await db.from('live_class_presentations').select('annotations')
        .eq('id', active.id).eq('live_class_id', liveClass.id).maybeSingle()
      if (annotationError) throw annotationError
      active.annotations = withAnnotations?.annotations || {}
    }
    return c.json({ data: {
      teaching_mode: liveClass.teaching_mode || 'whiteboard',       presentations: rows.map((row) => publicPresentation(row, { includeAnnotations: Boolean(row.is_active) })), legacy_slide_urls: [],
      pagination: { page: pagination.page, page_size: pagination.pageSize, has_more: rows.length === pagination.pageSize },
    } })
  } catch (error) {
    if (error instanceof MemberLookupError) return memberLookupUnavailable(c)
    console.error('[public-live-class] presentations failed', error)
    return c.json({ error: 'Could not load presentation materials', code: 'PRESENTATIONS_FAILED' }, 500)
  }
})

publicLiveClassesRouter.get('/:shareToken/presentations/:presentationId/view', async c => {
  try {
    const liveClass = await findClass(c.req.param('shareToken')!)
    if (!liveClass || liveClass.share_link_revoked_at || liveClass.status !== 'live') return c.json({ error: 'This class is unavailable', code: 'CLASS_UNAVAILABLE' }, 404)
    const [guest, member] = await Promise.all([currentGuest(liveClass.id, c), recognisedMember(c, liveClass)])
    if (!guest && !member) return c.json({ error: 'Join this class before viewing its materials', code: 'GUEST_SESSION_REQUIRED' }, 401)
    const { data, error } = await db.from('live_class_presentations').select('file_key, processing_status').eq('id', c.req.param('presentationId')!).eq('live_class_id', liveClass.id).maybeSingle()
    if (error || !data || data.processing_status !== 'ready') return c.json({ error: 'Material is not ready', code: 'MATERIAL_NOT_READY' }, 409)
    return c.json({ data: { url: await createPresignedDownload(data.file_key, liveClass.school_id, 600), expires_in_seconds: 600 } })
  } catch (error) {
    if (error instanceof MemberLookupError) return memberLookupUnavailable(c)
    console.error('[public-live-class] presentation view failed', error)
    return c.json({ error: 'Could not load this material', code: 'MATERIAL_VIEW_FAILED' }, 500)
  }
})

publicLiveClassesRouter.get('/:shareToken/presentations/:presentationId/pages/:page/view', async c => {
  try {
    const liveClass = await findClass(c.req.param('shareToken')!)
    if (!liveClass || liveClass.share_link_revoked_at || liveClass.status !== 'live') return c.json({ error: 'This class is unavailable', code: 'CLASS_UNAVAILABLE' }, 404)
    const [guest, member] = await Promise.all([currentGuest(liveClass.id, c), recognisedMember(c, liveClass)])
    if (!guest && !member) return c.json({ error: 'Join this class before viewing its materials', code: 'GUEST_SESSION_REQUIRED' }, 401)
    const { data, error } = await db.from('live_class_presentations')
      .select('page_count, page_image_keys, processing_status')
      .eq('id', c.req.param('presentationId')).eq('live_class_id', liveClass.id).maybeSingle()
    if (error || !data || data.processing_status !== 'ready') return c.json({ error: 'Material is not ready', code: 'MATERIAL_NOT_READY' }, 409)
    const page = Number(c.req.param('page'))
    if (!Number.isInteger(page) || page < 1 || page > data.page_count) return c.json({ error: 'Page is outside this document', code: 'INVALID_PAGE' }, 400)
    const pageImageKey = data.page_image_keys?.[String(page)]
    if (!pageImageKey) return c.json({ error: 'This page is still being prepared', code: 'PAGE_NOT_READY' }, 409)
    return c.json({ data: {
      url: await createPresignedDownload(pageImageKey, liveClass.school_id, 3600, { responseCacheControl: 'private, max-age=3300, immutable' }),
      page, expires_in_seconds: 3600,
    } })
  } catch (error) {
    if (error instanceof MemberLookupError) return memberLookupUnavailable(c)
    console.error('[public-live-class] presentation page view failed', error)
    return c.json({ error: 'Could not load this page', code: 'PAGE_VIEW_FAILED' }, 500)
  }
})
