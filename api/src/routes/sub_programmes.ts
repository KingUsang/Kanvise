import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { jwtVerificationMiddleware, profileResolutionMiddleware, tenantMiddleware, requireRole } from '../middleware/auth'

export const subProgrammesRouter = new Hono<{ Variables: { user: any; jwt_payload?: any } }>()

subProgrammesRouter.use('*', jwtVerificationMiddleware)
subProgrammesRouter.use('*', profileResolutionMiddleware)
subProgrammesRouter.use('*', tenantMiddleware)

// ---------------------------------------------------------------------------
// 1. PATCH /:id - Update Sub-Programme (Admin Only)
// ---------------------------------------------------------------------------
subProgrammesRouter.patch('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json()

  const updates: any = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.description !== undefined) updates.description = body.description
  if (body.price !== undefined) updates.price = body.price
  updates.updated_at = new Date().toISOString()

  const { data: subProgramme, error } = await supabase
    .from('sub_programmes')
    .update(updates)
    .eq('id', id)
    .eq('school_id', user.school_id)
    .select()
    .single()

  if (error) return c.json({ error: error.message }, 500)
  if (!subProgramme) return c.json({ error: 'SUB_PROGRAMME_NOT_FOUND' }, 404)

  return c.json({ sub_programme: subProgramme })
})

// ---------------------------------------------------------------------------
// 2. POST /:id/publish & unpublish - Publish toggle (Admin Only)
// ---------------------------------------------------------------------------
subProgrammesRouter.post('/:id/publish', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { error } = await supabase
    .from('sub_programmes')
    .update({ is_published: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Sub-programme published' })
})

subProgrammesRouter.post('/:id/unpublish', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  const { error } = await supabase
    .from('sub_programmes')
    .update({ is_published: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Sub-programme unpublished' })
})

// ---------------------------------------------------------------------------
// 3. DELETE /:id - Delete Sub-Programme (Admin Only)
// ---------------------------------------------------------------------------
subProgrammesRouter.delete('/:id', requireRole('admin'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')

  // Cannot delete if active enrolments exist
  const { count } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('sub_programme_id', id)
    .eq('school_id', user.school_id)

  if (count && count > 0) {
    return c.json({ error: 'ACTIVE_ENROLMENTS_EXIST', message: 'Cannot delete sub-programme with active student enrolments.' }, 409)
  }

  const { error } = await supabase
    .from('sub_programmes')
    .delete()
    .eq('id', id)
    .eq('school_id', user.school_id)

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ message: 'Sub-programme deleted successfully' })
})
