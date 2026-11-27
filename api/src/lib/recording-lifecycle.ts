/**
 * Recording lifecycle projection, kept separate from signed playback URLs so
 * clients can tell "no recording", "still processing" and "failed" apart
 * (DEV-LVC-019).
 */
export type RecordingLifecycle = 'none' | 'processing' | 'failed' | 'ready'

export function recordingLifecycle(rows: Array<{ status?: string | null }> | null | undefined): { status: RecordingLifecycle; ready: any | null } {
  const list = rows || []
  const ready = list.find((row) => row.status === 'ready')
  if (ready) return { status: 'ready', ready }
  if (!list.length) return { status: 'none', ready: null }
  // Rows arrive newest first; a newer in-flight row outranks an older failure.
  const active = list.find((row) => row.status !== 'failed')
  return { status: active ? 'processing' : 'failed', ready: null }
}

export function recordingLifecycleFailure(status: RecordingLifecycle) {
  if (status === 'processing') return { status: 409 as const, error: 'This recording is still being prepared. Please check back shortly.', code: 'RECORDING_PROCESSING' }
  if (status === 'failed') return { status: 409 as const, error: 'This recording could not be prepared. Please contact your tutor or centre.', code: 'RECORDING_FAILED' }
  return { status: 404 as const, error: 'Recording is not ready', code: 'RECORDING_NOT_READY' }
}
