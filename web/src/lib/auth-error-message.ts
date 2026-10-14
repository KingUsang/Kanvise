type AuthErrorLike = { code?: string | null; message?: string | null } | null | undefined

export function signInErrorMessage(error: AuthErrorLike) {
  switch (error?.code) {
    case 'invalid_credentials':
      return "We couldn't sign you in with those details. Check your email and password and try again."
    case 'email_not_confirmed':
      return 'Verify your email address before signing in.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts were made. Wait a moment and try again.'
    default:
      return "We couldn't sign you in right now. Try again."
  }
}

export function signUpErrorMessage(error: AuthErrorLike) {
  switch (error?.code) {
    case 'user_already_exists':
    case 'email_exists':
      return 'An account already uses this email. Sign in, or reset your password if you have forgotten it.'
    case 'weak_password':
      return 'Your password does not meet the requirements shown below.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts were made. Wait a moment and try again.'
    default:
      return "We couldn't create your account right now. Try again."
  }
}

export function verificationErrorMessage(error: AuthErrorLike) {
  switch (error?.code) {
    case 'otp_expired':
      return 'This code has expired. Request a new one.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many attempts were made. Wait a moment and try again.'
    default:
      return "That code doesn't match. Check it and try again."
  }
}

export function recoveryRequestErrorMessage(error: AuthErrorLike) {
  switch (error?.code) {
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Too many recovery requests were made. Wait a moment and try again.'
    default:
      return "We couldn't send a recovery code right now. Try again."
  }
}

export function passwordUpdateErrorMessage(error: AuthErrorLike) {
  if (error?.code === 'weak_password') return 'Your password does not meet the requirements shown below.'
  return "We couldn't update your password right now. Try again."
}
