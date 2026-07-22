import { Hono } from 'hono'
import { supabase } from '../lib/supabase'

export const publicRouter = new Hono()

// GET /public/schools/:slug
// Fetches the public storefront data for a school
publicRouter.get('/schools/:slug', async (c) => {
  const slug = c.req.param('slug')

  try {
    // 1. Resolve school from slug
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, slug, description, logo_url, banner_url, video_intro_url, contact_email, contact_phone, website_url, instagram_url, twitter_url, facebook_url, whatsapp_number')
      .eq('slug', slug)
      .eq('is_active', true)
      .single()

    if (schoolError || !school) {
      return c.json({ error: 'School not found' }, 404)
    }

    // 2. Fetch published programmes
    const { data: programmes, error: progError } = await supabase
      .from('programmes')
      .select('id, name, slug, description, price, is_published') // Add thumbnail_url/key if they exist in schema
      .eq('school_id', school.id)
      .eq('is_published', true)

    // 3. Fetch standalone published courses (courses without programme_id)
    const { data: standaloneCourses, error: courseError } = await supabase
      .from('courses')
      .select('id, name, slug, description, price, is_published')
      .eq('school_id', school.id)
      .is('programme_id', null)
      .is('sub_programme_id', null)
      .eq('is_published', true)

    // 4. Fetch Tutors associated with this school (user_profiles where role='tutor' and school_id matches)
    const { data: tutors, error: tutorsError } = await supabase
      .from('user_profiles')
      .select('id, first_name, last_name, bio, role')
      .eq('school_id', school.id)
      .eq('role', 'tutor')

    if (progError) console.error("Error fetching programmes:", progError)
    if (courseError) console.error("Error fetching courses:", courseError)
    if (tutorsError) console.error("Error fetching tutors:", tutorsError)

    // Note: To implement enrolled counts, we would need to query the enrolments table and aggregate.
    // For now, returning basic lists.

    return c.json({
      data: {
        school,
        programmes: programmes || [],
        standalone_courses: standaloneCourses || [],
        tutors: tutors || []
      }
    })
  } catch (err: any) {
    console.error("Public School Endpoint Error:", err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /public/programmes/:slug
// Fetches the public marketing data for a specific programme
publicRouter.get('/programmes/:slug', async (c) => {
  const slug = c.req.param('slug')

  try {
    // 1. Fetch programme details
    const { data: programme, error: progError } = await supabase
      .from('programmes')
      .select('id, name, slug, description, price, school_id')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (progError || !programme) {
      // It might be a course slug instead, but for MVP let's assume it's a programme slug
      return c.json({ error: 'Programme not found' }, 404)
    }

    // 2. Resolve school details
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, slug')
      .eq('id', programme.school_id)
      .eq('is_active', true)
      .single()

    if (schoolError || !school) return c.json({ error: 'Programme not found' }, 404)

    // 3. Fetch sub-programmes under this programme
    const { data: subProgrammes, error: subProgError } = await supabase
      .from('sub_programmes')
      .select('id, name, slug, description, price')
      .eq('programme_id', programme.id)
      .eq('is_published', true)

    // 4. Fetch courses under this programme (both direct and via sub-programmes)
    const { data: courses, error: courseError } = await supabase
      .from('courses')
      .select('id, name, slug, description, price, sub_programme_id')
      .eq('programme_id', programme.id)
      .eq('is_published', true)

    return c.json({
      data: {
        programme,
        school,
        sub_programmes: subProgrammes || [],
        courses: courses || []
      }
    })
  } catch (err: any) {
    console.error("Public Programme Endpoint Error:", err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// GET /public/courses/:slug
// Fetches the public marketing data for a standalone course
publicRouter.get('/courses/:slug', async (c) => {
  const slug = c.req.param('slug')

  try {
    const { data: course, error: courseError } = await supabase
      .from('courses')
      .select('id, name, slug, description, price, school_id')
      .eq('slug', slug)
      .eq('is_published', true)
      .single()

    if (courseError || !course) {
      return c.json({ error: 'Course not found' }, 404)
    }

    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('id, name, slug')
      .eq('id', course.school_id)
      .eq('is_active', true)
      .single()

    if (schoolError || !school) return c.json({ error: 'Course not found' }, 404)

    return c.json({
      data: {
        course,
        school
      }
    })
  } catch (err: any) {
    console.error("Public Course Endpoint Error:", err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})
