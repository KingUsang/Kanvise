export type InvitationSessionFragment =
  | { accessToken: string; refreshToken: string; error: null }
  | { accessToken: null; refreshToken: null; error: string }

export function readInvitationSessionFragment(hash: string): InvitationSessionFragment {
  const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const providerError = params.get('error_description') || params.get('error')

  if (providerError) {
    return { accessToken: null, refreshToken: null, error: providerError.replace(/\+/g, ' ') }
  }

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken || !refreshToken) {
    return {
      accessToken: null,
      refreshToken: null,
      error: 'Your invitation link did not contain a complete sign-in session.',
    }
  }

  return { accessToken, refreshToken, error: null }
}
