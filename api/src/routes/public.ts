import { Hono } from 'hono'
import { supabase } from '../lib/supabase'

export const publicRouter = new Hono()

// ---------------------------------------------------------------------------
// 1. GET /schools/:slug - Full Storefront Data (No Auth Required)
// Returns school branding, published bootcamps, standalone courses & promos
// ---------------------------------------------------------------------------
publicRouter.get('/schools/:slug', async (c) => {
  const slug = c.req.param('slug')

  // 1. Fetch School Profile
  const { data: school, error: schoolErr } = await supabase
    .from('schools')
    .select('*')
    .eq('slug', slug)
    .single()

  if (schoolErr || !school) {
    return c.json({ error: 'SCHOOL_NOT_FOUND', message: 'Tutorial centre storefront not found.' }, 404)
  }

  // 2. Total Enrolments Count
  const { count: enrolledCount } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('school_id', school.id)

  // 3. Published Programmes (Bootcamps)
  const { data: programmes } = await supabase
    .from('programmes')
    .select('*')
    .eq('school_id', school.id)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // Calculate stats for each programme
  const enrichedProgrammes = await Promise.all(
    (programmes || []).map(async (prog: any) => {
      const { count: progEnrolled } = await supabase
        .from('enrolments')
        .select('id', { count: 'exact', head: true })
        .eq('programme_id', prog.id)

      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('programme_id', prog.id)
        .eq('is_published', true)

      const ratings = (reviews || []).map((r: any) => r.rating)
      const avgRating = ratings.length > 0
        ? Number((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1))
        : 5.0

      return {
        id: prog.id,
        name: prog.name,
        slug: prog.slug,
        description: prog.description,
        price: Number(prog.price),
        currency: prog.currency,
        thumbnail_url: prog.thumbnail_url,
        enrolled_count: progEnrolled || 0,
        average_rating: avgRating,
        is_free: Number(prog.price) === 0
      }
    })
  )

  // 4. Standalone Courses (No parent programme or sub-programme)
  const { data: standaloneCourses } = await supabase
    .from('courses')
    .select('*')
    .eq('school_id', school.id)
    .is('programme_id', null)
    .is('sub_programme_id', null)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const enrichedStandalone = (standaloneCourses || []).map((sc: any) => ({
    ...sc,
    price: Number(sc.price),
    is_free: Number(sc.price) === 0
  }))

  // 5. Tutors Roster
  const { data: tutors } = await supabase
    .from('user_profiles')
    .select('id, first_name, last_name, bio, profile_photo_url')
    .eq('school_id', school.id)
    .eq('role', 'tutor')
    .eq('is_active', true)

  // 6. Active Promotional Banners
  const { data: promos } = await supabase
    .from('school_promos')
    .select('id, title, image_key, link_type, link_id, order_index')
    .eq('school_id', school.id)
    .eq('is_active', true)
    .order('order_index', { ascending: true })

  return c.json({
    data: {
      id: school.id,
      name: school.name,
      slug: school.slug,
      description: school.description,
      address: school.address || null,
      logo_url: school.logo_key ? `https://storage.kanvise.ng/${school.logo_key}` : null,
      banner_url: school.banner_key ? `https://storage.kanvise.ng/${school.banner_key}` : null,
      video_intro_url: school.video_intro_key ? `https://storage.kanvise.ng/${school.video_intro_key}` : null,
      contact_email: school.contact_email,
      contact_phone: school.contact_phone,
      website_url: school.website_url,
      instagram_url: school.instagram_url,
      twitter_url: school.twitter_url,
      facebook_url: school.facebook_url,
      whatsapp_number: school.whatsapp_number,
      enrolled_count: enrolledCount || 0,
      programmes: enrichedProgrammes,
      standalone_courses: enrichedStandalone,
      tutors: tutors || [],
      promos: promos || []
    }
  })
})

// ---------------------------------------------------------------------------
// 2. GET /programmes/:id - Programme Marketing & Enrolment Page
// ---------------------------------------------------------------------------
publicRouter.get('/programmes/:id', async (c) => {
  const id = c.req.param('id')

  const { data: prog, error } = await supabase
    .from('programmes')
    .select(`
      *,
      schools(id, name, slug),
      sub_programmes(id, name, description, price, currency, is_published),
      courses(id, name, description, price, currency, is_published, sub_programme_id)
    `)
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (error || !prog) {
    return c.json({ error: 'PROGRAMME_NOT_FOUND', message: 'Programme not found or unpublished.' }, 404)
  }

  // Filter published sub-programmes and attach child courses
  const publishedSubProgs = (prog.sub_programmes || [])
    .filter((sp: any) => sp.is_published)
    .map((sp: any) => ({
      ...sp,
      price: Number(sp.price),
      is_free: Number(sp.price) === 0,
      courses: (prog.courses || [])
        .filter((co: any) => co.sub_programme_id === sp.id && co.is_published)
        .map((co: any) => ({ id: co.id, name: co.name, description: co.description }))
    }))

  // Direct courses not under sub-programmes
  const directCourses = (prog.courses || [])
    .filter((co: any) => !co.sub_programme_id && co.is_published)
    .map((co: any) => ({ id: co.id, name: co.name, description: co.description }))

  // Enrolled count
  const { count: enrolledCount } = await supabase
    .from('enrolments')
    .select('id', { count: 'exact', head: true })
    .eq('programme_id', id)

  // Reviews & average rating
  const { data: reviews } = await supabase
    .from('reviews')
    .select(`
      id, rating, review_text, created_at,
      user_profiles!student_id(first_name, last_name, profile_photo_url)
    `)
    .eq('programme_id', id)
    .eq('is_published', true)

  const ratings = (reviews || []).map((r: any) => r.rating)
  const avgRating = ratings.length > 0
    ? Number((ratings.reduce((a: number, b: number) => a + b, 0) / ratings.length).toFixed(1))
    : 5.0

  return c.json({
    data: {
      id: prog.id,
      name: prog.name,
      slug: prog.slug,
      description: prog.description,
      price: Number(prog.price),
      currency: prog.currency,
      thumbnail_url: prog.thumbnail_url,
      is_free: Number(prog.price) === 0,
      enrolled_count: enrolledCount || 0,
      school: prog.schools,
      sub_programmes: publishedSubProgs,
      courses: directCourses,
      reviews: (reviews || []).map((r: any) => ({
        id: r.id,
        rating: r.rating,
        review_text: r.review_text,
        student_name: r.user_profiles ? `${r.user_profiles.first_name} ${r.user_profiles.last_name}` : 'Anonymous',
        created_at: r.created_at
      })),
      average_rating: avgRating,
      review_count: ratings.length
    }
  })
})

// ---------------------------------------------------------------------------
// 3. GET /sub-programmes/:id - Track Marketing Page
// ---------------------------------------------------------------------------
publicRouter.get('/sub-programmes/:id', async (c) => {
  const id = c.req.param('id')

  const { data: subProg, error } = await supabase
    .from('sub_programmes')
    .select(`
      *,
      schools(id, name, slug),
      programmes(id, name, slug),
      courses(id, name, description, is_published)
    `)
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (error || !subProg) {
    return c.json({ error: 'SUB_PROGRAMME_NOT_FOUND' }, 404)
  }

  const publishedCourses = (subProg.courses || [])
    .filter((co: any) => co.is_published)
    .map((co: any) => ({ id: co.id, name: co.name, description: co.description }))

  return c.json({
    data: {
      id: subProg.id,
      name: subProg.name,
      slug: subProg.slug,
      description: subProg.description,
      price: Number(subProg.price),
      currency: subProg.currency,
      is_free: Number(subProg.price) === 0,
      school: subProg.schools,
      programme: subProg.programmes,
      courses: publishedCourses
    }
  })
})

// ---------------------------------------------------------------------------
// 4. GET /courses/:id - Standalone Course Page
// ---------------------------------------------------------------------------
publicRouter.get('/courses/:id', async (c) => {
  const id = c.req.param('id')

  const { data: course, error } = await supabase
    .from('courses')
    .select(`
      *,
      schools(id, name, slug)
    `)
    .eq('id', id)
    .eq('is_published', true)
    .single()

  if (error || !course) {
    return c.json({ error: 'COURSE_NOT_FOUND' }, 404)
  }

  // Fetch assigned tutors
  const { data: assignments } = await supabase
    .from('tutor_course_assignments')
    .select(`
      user_profiles!tutor_id(id, first_name, last_name, bio, profile_photo_url)
    `)
    .eq('course_id', id)

  const tutors = (assignments || []).map((a: any) => a.user_profiles)

  return c.json({
    data: {
      id: course.id,
      name: course.name,
      slug: course.slug,
      description: course.description,
      price: Number(course.price),
      currency: course.currency,
      is_free: Number(course.price) === 0,
      school: course.schools,
      tutors: tutors
    }
  })
})
