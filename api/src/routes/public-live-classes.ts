import { createHash, randomBytes } from 'node:crypto'
import { Hono } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { supabase } from '../lib/supabase'
import { createPresignedDownload } from '../storage/r2'
import { getPlugNmeetClientConfig, providerForClass } from '../plugnmeet/provider'

export const publicLiveClassesRouter = new Hono()
const db = supabase as any
const cookieName = 'kanvise_live_guest'
const guestLifetimeSeconds = 12 * 60 * 60

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

function publicClassData(liveClass: any) {
  return {
    title: liveClass.title,
    status: liveClass.share_link_revoked_at ? 'revoked' : liveClass.status,
    scheduled_at: liveClass.scheduled_at,
    centre_name: liveClass.school?.name || 'Kanvise centre',
    centre_logo_url: liveClass.school?.logo_url || null,
    access_mode: liveClass.access_mode,
  }
}

function publicPresentation(row: any) {
  const pageImageKeys = row.page_image_keys && typeof row.page_image_keys === 'object' ? row.page_image_keys : {}
  return {
    id: row.id, filename: row.filename, file_size_bytes: row.file_size_bytes,
    page_count: row.page_count, processing_status: row.processing_status || 'ready',
    processing_error: row.processing_error || null, sort_order: row.sort_order,
    current_page: row.current_page, is_active: row.is_active, annotations: row.annotations || {},
    page_images_ready: Object.keys(pageImageKeys).length,
    created_at: row.created_at, updated_at: row.updated_at,
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

async function recognisedMember(c: any, liveClass: any) {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) return null
  const { data: auth, error: authError } = await supabase.auth.getUser(header.slice(7))
  if (authError || !auth.user) return null
  const { data } = await db.from('user_profiles').select('id, school_id, role, first_name, last_name, kanvise_user_id')
    .eq('supabase_auth_id', auth.user.id).eq('school_id', liveClass.school_id).maybeSingle()
  if (!data) return null
  if (liveClass.access_mode === 'enrolled_learners') {
    if (data.role !== 'student' || !liveClass.course_id) return null
    const { data: enrolment } = await db.from('enrolments').select('id').eq('student_id', data.id).eq('course_id', liveClass.course_id).eq('school_id', liveClass.school_id).maybeSingle()
    if (!enrolment) return null
  }
  return data || null
}

async function findClassById(classId: string) {
  if (!/^[0-9a-f-]{36}$/.test(classId) && !/^\d+$/.test(classId)) return null
  const { data, error } = await db.from('live_classes')
    .select('id, school_id, course_id, title, status, scheduled_at, livekit_room_name, tutor_id, teaching_mode, access_mode, share_link_revoked_at, school:schools(name, logo_url)')
    .eq('id', classId).maybeSingle()
  if (error) throw error
  return data
}

// GET /public/live-classes/by-id/:classId — used when unauthenticated visitor lands on /class/:id
publicLiveClassesRouter.get('/by-id/:classId', async c => {
  try {
    const liveClass = await findClassById(c.req.param('classId')!)
    if (!liveClass) return c.json({ error: 'Class not found', code: 'CLASS_NOT_FOUND' }, 404)
    return c.json({ data: publicClassData(liveClass) })
  } catch (error) {
    console.error('[public-live-class] by-id lookup failed', error)
    return c.json({ error: 'Could not load this class', code: 'LOOKUP_FAILED' }, 500)
  }
})

publicLiveClassesRouter.get('/:shareToken', async c => {

  try {
    const liveClass = await findClass(c.req.param('shareToken')!)
    if (!liveClass) return c.json({ error: 'This class link is unavailable', code: 'LINK_UNAVAILABLE' }, 404)
    return c.json({ data: publicClassData(liveClass) })
  } catch (error) {
    console.error('[public-live-class] lookup failed', error)
    return c.json({ error: 'Could not load this class', code: 'LOOKUP_FAILED' }, 500)
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
      return c.json({ error: liveClass.status === 'completed' ? 'This class has ended' : 'Your tutor has not started this class yet', code: liveClass.status === 'completed' ? 'CLASS_ENDED' : 'CLASS_NOT_LIVE' }, 409)
    }

    const body = await c.req.json().catch(() => ({}))
    const requestedName = typeof body.display_name === 'string' ? body.display_name.trim().replace(/\s+/g, ' ') : ''
    let guest = await currentGuest(liveClass.id, c)
    if (!guest) {
      if (requestedName.length < 2 || requestedName.length > 60) return c.json({ error: 'Enter a name between 2 and 60 characters', code: 'INVALID_DISPLAY_NAME' }, 400)
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
    const { data, error } = await db.from('live_class_presentations').select('*').eq('live_class_id', liveClass.id).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    if (error) throw error
    return c.json({ data: { teaching_mode: liveClass.teaching_mode || 'whiteboard', tutor_identity: liveClass.tutor_id, presentations: (data || []).map(publicPresentation), legacy_slide_urls: [] } })
  } catch (error) {
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
    console.error('[public-live-class] presentation page view failed', error)
    return c.json({ error: 'Could not load this page', code: 'PAGE_VIEW_FAILED' }, 500)
  }
})
