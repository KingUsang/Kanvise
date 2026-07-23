export function validateStudentProfileUpdate(body: Record<string, unknown>) {
  const errors: string[] = []
  const updates: Record<string, string | null> = {}
  for (const field of ['first_name', 'last_name'] as const) {
    if (body[field] !== undefined) {
      const value = typeof body[field] === 'string' ? body[field].trim() : ''
      if (!value || value.length > 80) errors.push(`${field.replace('_', ' ')} must be between 1 and 80 characters`)
      else updates[field] = value
    }
  }
  if (body.bio !== undefined) {
    const value = typeof body.bio === 'string' ? body.bio.trim() : ''
    if (value.length > 500) errors.push('Bio cannot exceed 500 characters')
    else updates.bio = value || null
  }
  return { errors, updates }
}
