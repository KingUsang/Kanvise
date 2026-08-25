import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, requireRole, tenantMiddleware } from '../middleware/auth'
import { publicFileUrl } from '../storage/r2'
import { validateStudentProfileUpdate } from '../domain/student-settings'
import { validateStudentSubjectCombination } from '../domain/student-subject-combination'
import type { TenantVariables } from '../types'
import type { TablesUpdate } from '../lib/database.types'

export const studentSettingsRouter = new Hono<{ Variables: TenantVariables }>()
// The router is mounted at `/`, so its middleware must be limited to the
// student namespace. A root wildcard would reject unrelated admin endpoints.
studentSettingsRouter.use('/students/*', jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware)
studentSettingsRouter.use('/students/*', requireRole('student'))

studentSettingsRouter.get('/students/me/settings', async c => {
  const user = c.get('user')
  const [{ data: profile, error }, { data: school, error: schoolError }] = await Promise.all([
    supabase.from('user_profiles').select('id, kanvise_user_id, first_name, last_name, email, bio, profile_photo_key')
      .eq('id', user.id).eq('school_id', user.school_id).eq('role', 'student').maybeSingle(),
    supabase.from('schools').select('id, name').eq('id', user.school_id).maybeSingle(),
  ])
  if (error || schoolError) return c.json({ error: 'Could not load your settings', code: 'SETTINGS_LOAD_FAILED' }, 500)
  if (!profile) return c.json({ error: 'Student profile not found', code: 'NOT_FOUND' }, 404)
  const { profile_photo_key, ...safeProfile } = profile
  return c.json({ data: {
    profile: { ...safeProfile, profile_photo_url: profile_photo_key ? publicFileUrl(profile_photo_key) : null },
    school,
  } })
})

studentSettingsRouter.patch('/students/me/settings', async c => {
  const user = c.get('user')
  const body = await c.req.json()
  const { errors, updates } = validateStudentProfileUpdate(body)
  if (errors.length) return c.json({ error: 'Check your profile details', code: 'VALIDATION_ERROR', details: errors }, 400)
  if (!Object.keys(updates).length) return c.json({ error: 'No supported changes provided', code: 'NO_CHANGES' }, 400)
  const { data, error } = await supabase.from('user_profiles').update(updates as TablesUpdate<'user_profiles'>)
    .eq('id', user.id).eq('school_id', user.school_id).eq('role', 'student')
    .select('id, kanvise_user_id, first_name, last_name, email, bio, profile_photo_key').maybeSingle()
  if (error) return c.json({ error: 'Could not update your profile', code: 'SETTINGS_UPDATE_FAILED' }, 500)
  if (!data) return c.json({ error: 'Student profile not found', code: 'NOT_FOUND' }, 404)
  const { profile_photo_key, ...safeProfile } = data
  return c.json({ data: { ...safeProfile, profile_photo_url: profile_photo_key ? publicFileUrl(profile_photo_key) : null } })
})

// A programme student keeps one explicit JAMB subject combination. Adaptive
// mocks use this record only when an attempt starts, then snapshot its
// questions so a later change cannot alter a live or submitted attempt.
studentSettingsRouter.get('/students/me/subject-combination', async c => {
  const user = c.get('user')
  const programmeId = c.req.query('programme_id')
  if (!programmeId) return c.json({ error: 'programme_id is required', code: 'VALIDATION_ERROR' }, 400)
  const client = supabase as any
  const [{ data: enrolment, error: enrolmentError }, { data: selections, error: selectionError }] = await Promise.all([
    supabase.from('enrolments').select('id').eq('school_id', user.school_id).eq('student_id', user.id).eq('programme_id', programmeId).maybeSingle(),
    client.from('student_programme_subjects').select('course_id, course:courses(id, name)').eq('school_id', user.school_id)
      .eq('student_id', user.id).eq('programme_id', programmeId).order('created_at'),
  ])
  if (enrolmentError || selectionError) return c.json({ error: 'Could not load your subject combination', code: 'SUBJECT_COMBINATION_LOAD_FAILED' }, 500)
  if (!enrolment) return c.json({ error: 'You are not enrolled in this programme', code: 'PROGRAMME_ENROLMENT_REQUIRED' }, 403)
  return c.json({ data: { programme_id: programmeId, course_ids: (selections || []).map((item: any) => item.course_id), subjects: selections || [] } })
})

studentSettingsRouter.put('/students/me/subject-combination', async c => {
  const user = c.get('user')
  const body = await c.req.json()
  const programmeId = typeof body.programme_id === 'string' && body.programme_id ? body.programme_id : null
  const validated = validateStudentSubjectCombination(body.course_ids)
  if (!programmeId || 'error' in validated) return c.json({ error: !programmeId ? 'programme_id is required' : validated.error, code: 'VALIDATION_ERROR' }, 400)

  const [{ data: enrolment, error: enrolmentError }, { data: programme, error: programmeError }, { data: subProgrammes, error: subProgrammeError }] = await Promise.all([
    supabase.from('enrolments').select('id').eq('school_id', user.school_id).eq('student_id', user.id).eq('programme_id', programmeId).maybeSingle(),
    supabase.from('programmes').select('id').eq('id', programmeId).eq('school_id', user.school_id).maybeSingle(),
    supabase.from('sub_programmes').select('id').eq('school_id', user.school_id).eq('programme_id', programmeId),
  ])
  if (enrolmentError || programmeError || subProgrammeError) return c.json({ error: 'Could not validate your subject combination', code: 'SUBJECT_COMBINATION_VALIDATION_FAILED' }, 500)
  if (!programme || !enrolment) return c.json({ error: 'You are not enrolled in this programme', code: 'PROGRAMME_ENROLMENT_REQUIRED' }, 403)

  const client = supabase as any
  let courseQuery = supabase.from('courses').select('id').eq('school_id', user.school_id).or(`programme_id.eq.${programmeId}${(subProgrammes || []).length ? `,sub_programme_id.in.(${(subProgrammes || []).map(item => item.id).join(',')})` : ''}`)
  const { data: courses, error: courseError } = await courseQuery.in('id', validated.courseIds)
  if (courseError) return c.json({ error: 'Could not validate your subjects', code: 'SUBJECT_COMBINATION_VALIDATION_FAILED' }, 500)
  if ((courses || []).length !== validated.courseIds.length) return c.json({ error: 'Choose subjects from your enrolled programme only', code: 'INVALID_PROGRAMME_SUBJECTS' }, 400)

  const { error: deleteError } = await client.from('student_programme_subjects').delete()
    .eq('school_id', user.school_id).eq('student_id', user.id).eq('programme_id', programmeId)
  if (deleteError) return c.json({ error: 'Could not save your subject combination', code: 'SUBJECT_COMBINATION_SAVE_FAILED' }, 500)
  const { data, error: insertError } = await client.from('student_programme_subjects').insert(validated.courseIds.map(course_id => ({
    school_id: user.school_id, student_id: user.id, programme_id: programmeId, course_id,
  }))).select('course_id, course:courses(id, name)')
  if (insertError) return c.json({ error: 'Could not save your subject combination', code: 'SUBJECT_COMBINATION_SAVE_FAILED' }, 500)
  return c.json({ data: { programme_id: programmeId, course_ids: validated.courseIds, subjects: data || [] } })
})
