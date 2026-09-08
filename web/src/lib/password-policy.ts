export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_REQUIREMENTS = 'At least 8 characters, one lowercase letter, one uppercase letter, and one number.'
export const PASSWORD_PATTERN = '(?=.*[a-z])(?=.*[A-Z])(?=.*\\d).{8,}'

export function passwordChecks(password: string) {
  return {
    hasMinLength: password.length >= PASSWORD_MIN_LENGTH,
    hasLowercase: /[a-z]/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasNumber: /\d/.test(password),
  }
}

export function meetsPasswordPolicy(password: string) {
  const checks = passwordChecks(password)
  return checks.hasMinLength && checks.hasLowercase && checks.hasUppercase && checks.hasNumber
}
