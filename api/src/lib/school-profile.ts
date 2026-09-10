export class SchoolProfileValidationError extends Error {
  constructor(public field: string, message: string) {
    super(message)
    this.name = 'SchoolProfileValidationError'
  }
}

const MAX_SCHOOL_SLUG_LENGTH = 64

export function normalizeSchoolSlug(value: unknown) {
  return String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SCHOOL_SLUG_LENGTH)
    .replace(/-+$/g, '')
}

export function schoolSlugCandidates(name: string, requestedSlug?: unknown, limit = 20) {
  const explicitSlug = requestedSlug !== undefined && requestedSlug !== null
  const base = explicitSlug ? String(requestedSlug).trim() : normalizeSchoolSlug(name)
  if (explicitSlug || limit <= 1) return [base]

  return Array.from({ length: limit }, (_, index) => {
    if (index === 0) return base
    const suffix = `-${index + 1}`
    return `${base.slice(0, MAX_SCHOOL_SLUG_LENGTH - suffix.length).replace(/-+$/g, '')}${suffix}`
  })
}

function optionalText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizeWebUrl(value: unknown, field: string, allowedDomains?: string[]) {
  const text = optionalText(value)
  if (!text) return null

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(text) ? text : `https://${text}`
  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    throw new SchoolProfileValidationError(field, 'Enter a valid web address')
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) {
    throw new SchoolProfileValidationError(field, 'Enter a valid public http or https address')
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '')
  if (allowedDomains && !allowedDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))) {
    throw new SchoolProfileValidationError(field, `Use a ${allowedDomains.join(' or ')} profile link`)
  }

  url.protocol = 'https:'
  url.hash = ''
  return url.toString()
}

function normalizeSocialProfile(value: unknown, field: string, canonicalDomain: string, allowedDomains: string[], handlePattern: RegExp) {
  const text = optionalText(value)
  if (!text) return null
  const possibleHandle = text.replace(/^@/, '')
  if (!text.includes('/') && handlePattern.test(possibleHandle)) {
    return `https://${canonicalDomain}/${possibleHandle}`
  }
  return normalizeWebUrl(text, field, allowedDomains)
}

function normalizeEmail(value: unknown) {
  const email = optionalText(value)?.toLowerCase() || null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new SchoolProfileValidationError('contact_email', 'Enter a valid support email address')
  }
  return email
}

function normalizeInternationalPhone(value: unknown, field: string) {
  const text = optionalText(value)
  if (!text) return null
  const normalized = text.replace(/[\s().-]/g, '').replace(/^00/, '+')
  if (!/^\+[1-9]\d{6,14}$/.test(normalized)) {
    throw new SchoolProfileValidationError(field, 'Include the country code, for example +234 801 234 5678')
  }
  return normalized
}

export function normalizeSchoolProfileUpdate(body: Record<string, unknown>) {
  const result: Record<string, string | boolean | null> = {}

  if (body.name !== undefined) {
    const name = optionalText(body.name)
    if (!name) throw new SchoolProfileValidationError('name', 'Centre name is required')
    result.name = name
  }
  if (body.slug !== undefined) {
    const slug = String(body.slug).trim()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      throw new SchoolProfileValidationError('slug', 'Student-page address must use lowercase letters, numbers and single hyphens only')
    }
    result.slug = slug
  }
  if (body.description !== undefined) {
    const description = optionalText(body.description)
    if (description && description.length > 500) {
      throw new SchoolProfileValidationError('description', 'Centre description cannot exceed 500 characters')
    }
    result.description = description
  }
  if (body.contact_email !== undefined) result.contact_email = normalizeEmail(body.contact_email)
  if (body.contact_phone !== undefined) result.contact_phone = normalizeInternationalPhone(body.contact_phone, 'contact_phone')
  if (body.whatsapp_number !== undefined) result.whatsapp_number = normalizeInternationalPhone(body.whatsapp_number, 'whatsapp_number')
  if (body.website_url !== undefined) result.website_url = normalizeWebUrl(body.website_url, 'website_url')
  if (body.instagram_url !== undefined) result.instagram_url = normalizeSocialProfile(body.instagram_url, 'instagram_url', 'instagram.com', ['instagram.com'], /^[a-z\d._]{1,30}$/i)
  if (body.twitter_url !== undefined) result.twitter_url = normalizeSocialProfile(body.twitter_url, 'twitter_url', 'x.com', ['x.com', 'twitter.com'], /^[a-z\d_]{1,15}$/i)
  if (body.facebook_url !== undefined) result.facebook_url = normalizeSocialProfile(body.facebook_url, 'facebook_url', 'facebook.com', ['facebook.com', 'fb.com'], /^[a-z\d.]{5,50}$/i)
  if (body.is_active !== undefined) {
    if (typeof body.is_active !== 'boolean') throw new SchoolProfileValidationError('is_active', 'Student-page visibility must be true or false')
    result.is_active = body.is_active
  }

  return result
}
