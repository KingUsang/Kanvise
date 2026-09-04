import { Hono } from 'hono'
import { supabase } from '../lib/supabase'
import { publicFileUrl } from '../storage/r2'

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
      .select('id, name, slug, description, price, currency, thumbnail_url, is_published')
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
      .eq('is_available_separately', true)

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
      .select('id, created_at, updated_at, name, slug, description, price, currency, thumbnail_url, is_published, school_id')
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
      .select('id, name, slug, logo_url')
      .eq('id', programme.school_id)
      .eq('is_active', true)
      .single()

    if (schoolError || !school) return c.json({ error: 'Programme not found' }, 404)

    // 3. Fetch sub-programmes under this programme
    const { data: subProgrammes, error: subProgError } = await supabase
      .from('sub_programmes')
      .select('id, created_at, updated_at, name, slug, description, price, currency, is_available_separately, is_published')
      .eq('programme_id', programme.id)
      .eq('is_published', true)

    // 4. Fetch courses directly under this programme and courses inside its sub-programmes.
    const subProgrammeIds = (subProgrammes || []).map((subProgramme) => subProgramme.id)
    const [directCoursesResult, nestedCoursesResult] = await Promise.all([
      supabase
        .from('courses')
        .select('id, created_at, updated_at, name, slug, description, price, currency, is_available_separately, is_published, programme_id, sub_programme_id')
        .eq('programme_id', programme.id)
        .eq('is_published', true),
      subProgrammeIds.length
        ? supabase
            .from('courses')
            .select('id, created_at, updated_at, name, slug, description, price, currency, is_available_separately, is_published, programme_id, sub_programme_id')
            .in('sub_programme_id', subProgrammeIds)
            .eq('is_published', true)
        : Promise.resolve({ data: [], error: null }),
    ])

    const directCourses = directCoursesResult.data || []
    const nestedCourses = nestedCoursesResult.data || []
    const courses = [...directCourses, ...nestedCourses]
    const courseError = directCoursesResult.error || nestedCoursesResult.error

    // 5. Return tutors assigned to any course in the programme.
    const courseIds = courses.map((course) => course.id)
    let tutors: any[] = []
    let tutorError: any = null
    if (courseIds.length) {
      const { data: assignments, error: assignmentsError } = await supabase
        .from('tutor_course_assignments')
        .select('tutor_id')
        .in('course_id', courseIds)

      if (assignmentsError) {
        tutorError = assignmentsError
      } else {
        const tutorIds = [...new Set((assignments || []).map((assignment) => assignment.tutor_id))]
        if (tutorIds.length) {
          const { data: tutorProfiles, error: profilesError } = await supabase
            .from('user_profiles')
            .select('id, first_name, last_name, bio, profile_photo_key')
            .in('id', tutorIds)
            .eq('role', 'tutor')
            .eq('is_active', true)

          tutors = (tutorProfiles || []).map((tutor) => ({
            id: tutor.id,
            first_name: tutor.first_name,
            last_name: tutor.last_name,
            bio: tutor.bio,
            profile_photo_url: tutor.profile_photo_key && process.env.R2_PUBLIC_BASE_URL
              ? publicFileUrl(tutor.profile_photo_key)
              : null,
          }))
          tutorError = profilesError
        }
      }
    }

    if (subProgError) console.error('Error fetching programme sections:', subProgError)
    if (courseError) console.error('Error fetching programme courses:', courseError)
    if (tutorError) console.error('Error fetching programme tutors:', tutorError)

    // 6. Keep a flat course list for consumers while also exposing the hierarchy.
    const programmeSections = (subProgrammes || []).map((subProgramme) => ({
      ...subProgramme,
      courses: nestedCourses.filter((course) => course.sub_programme_id === subProgramme.id),
    }))

    /*
     * Do not expose internal ownership fields such as created_by or school_id
     * in the public representation. The fields below are the public product
     * information a student needs to decide whether to enrol.
     */
    const publicProgramme = {
      id: programme.id,
      created_at: programme.created_at,
      updated_at: programme.updated_at,
      name: programme.name,
      slug: programme.slug,
      description: programme.description,
      price: programme.price,
      currency: programme.currency,
      thumbnail_url: programme.thumbnail_url,
      is_published: programme.is_published,
    }

    return c.json({
      data: {
        programme: publicProgramme,
        school,
        sub_programmes: programmeSections,
        courses,
        tutors,
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
      .eq('is_available_separately', true)
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
