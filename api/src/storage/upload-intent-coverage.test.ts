import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRIVATE_UPLOAD_TYPES, PUBLIC_UPLOAD_TYPES } from './r2'

// Every presigned type records an upload intent, and the sweep deletes the
// object of any intent that is never consumed. A type is therefore only safe to
// presign when its registration route consumes the intent. Adding a type to
// r2.ts without listing its consuming route here fails this test.
const routes = join(__dirname, '..', 'routes')
const CONSUMING_ROUTE: Record<string, string | null> = {
  note: 'notes.ts', assignment_attachment: 'assignments.ts', submission: 'assignments.ts', question_media: 'question-banks.ts',
  logo: 'storage.ts', banner: 'storage.ts', video_intro: 'storage.ts', programme_thumbnail: 'storage.ts',
  profile_photo: 'storage.ts', promo: 'promos.ts',
  // Never presigned through recordUploadIntent paths (CLIENT_UPLOAD_TYPES excludes them).
  live_class_presentation: null, live_class_recording: null, live_class_transcript: null, feedback_screenshot: null,
}

describe('upload intent coverage', () => {
  it('maps every upload type to a decision', () => {
    for (const type of [...PRIVATE_UPLOAD_TYPES, ...PUBLIC_UPLOAD_TYPES]) expect(CONSUMING_ROUTE).toHaveProperty(type)
  })

  it('has a consuming call in each registration route', () => {
    for (const [type, file] of Object.entries(CONSUMING_ROUTE)) {
      if (!file) continue
      const source = readFileSync(join(routes, file), 'utf8')
      expect(source, `${type} -> ${file}`).toContain('consumeUploadIntent(')
    }
  })
})
