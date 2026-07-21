# Cloudflare R2 Audit Checkpoint

**Recorded:** 20 July 2026
**Status:** IN PROGRESS — private files verified; public-media backend implemented but not live-verified
**Scope:** Development code and tests; no database migration was applied.

## Resume point

The shared Cloudflare R2 private-storage path and the notes upload/download code
have been hardened and verified against the connected development bucket. Other
file-owning features listed below still need implementation or migration.

This conclusion applies to the local/connected development configuration that
was inspected. It does not establish whether staging or production has the same
environment-variable state.

## Configuration finding

The connected development environment now contains all required R2 values:

- `R2_BUCKET_NAME`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

The bucket and its scoped API credentials were verified without printing their
values. The SDK client uses path-style addressing for consistent R2 access.

The bucket initially had no CORS policy, so browser preflight requests returned
HTTP 403. A minimal development policy was applied for the configured frontend
origin, allowing `GET`, `PUT`, and `HEAD`, the `Content-Type` request header,
and exposure of `ETag`. Production/staging origins must be added when those
frontends are configured.

Do not put credential values in this document. Configure them through the
appropriate environment/secret manager when this work resumes.

## Upload-flow inventory

### Notes

The intended frontend flow exists:

1. Request a presigned PUT URL from `POST /storage/presigned-url`.
2. Upload the file directly from the browser to R2.
3. Create the note record through `POST /notes/:courseId`.

The underlying browser-to-R2 flow has now been verified live. Notes remain the
only substantially wired application upload flow.

Implemented in the first R2 work slice:

- Added the documented `/storage/presign/upload` and
  `/storage/presign/download` routes while retaining temporary aliases.
- Added a strict private entity allowlist for notes, assignment attachments,
  and submissions.
- Added school-, privacy-, and entity-scoped object keys.
- Added role and course-assignment checks before note/assignment presigning.
- Added size, MIME/extension agreement, R2 object metadata, and file-signature
  verification before a note record is created.
- Added tenant-safe download signing.
- Fixed student course/programme note authorization.
- Fixed note profile-UUID and tutor-relation mismatches.
- Added focused storage-policy regression tests.

### Assignments and submissions

Backend assignment attachment and student submission uploads are now
implemented through Hono and the shared R2 layer. Frontend work is intentionally
deferred until the approved Stitch designs are supplied.

The backend currently provides:

- course-authorized assignment creation and listing;
- assignment detail, update, publish, and guarded deletion;
- published-assignment and active-enrolment checks for student submissions;
- one submission per student, late-status calculation, tutor/admin submission
  listing, and signed private downloads;
- R2 object verification before attachment or submission registration;
- object keys bound to the exact course or assignment context;
- rejection of mismatched contexts and replayed file keys.

Backend verification added for wrong-role submission attempts, unenrolled
students, storage verification failures that do not proceed to insertion, and
concurrent duplicate submissions mapped from the database uniqueness violation
to `409 ALREADY_SUBMITTED`.

The dashboard sidebar links still have no implementation by design. Build them
from the approved Stitch designs only after the backend contract is accepted.

### Public media

The backend now supports public R2 uploads for school logos, banners and video
intros, programme thumbnails, promo images, and profile photos. No frontend UI
was added or changed for these flows.

- `POST /storage/presign/public` creates an authenticated, tenant- and
  context-scoped upload intent.
- `POST /storage/public/confirm` verifies the uploaded object before saving the
  school URL, programme thumbnail URL, or profile-photo key to Supabase.
- Promo create/update routes verify their uploaded image before saving its key.
- Replaced public objects are deleted only after the database update succeeds;
  cleanup failures are logged without invalidating the newly saved media.
- Images are limited to JPEG, PNG, or WebP and 10 MB. Video intros are limited
  to MP4, MOV, or WebM and 500 MB. Stored metadata and leading file signatures
  are checked before registration.
- The live schema was inspected read-only: schools and programmes use URL
  columns, while promos and profile photos use key columns. No schema migration
  was necessary.

The API still needs a separate `R2_PUBLIC_BUCKET_NAME` and
`R2_PUBLIC_BASE_URL` (for example, `https://cdn.kanvise.com`) before public
presigning can work. Neither is currently present in the development API
environment. A separate bucket is required because attaching an R2 custom
domain makes that bucket public; a key prefix alone does not make the other
objects private. The `r2.dev` development URL should remain disabled. Public
media UI integration remains deferred to the approved design work.

- Legacy programme thumbnail UI still targets the Supabase Storage bucket
  `kanvise-media` and must be replaced when that UI is implemented.
- Live-class presentation slides are now converted by the existing worker and
  uploaded by Hono to the separate public R2 bucket. New partial uploads are
  cleaned on failure, and old slides are removed only after the replacement
  URLs have been saved successfully.
- Avatar configuration records exist, but no R2 asset-upload flow was found.

## Security and correctness findings

Original findings and current disposition:

1. **RESOLVED FOR NOTES:** `POST /notes/:courseId` validates the school/entity
   prefix and verifies the object in R2 before inserting.
2. **RESOLVED:** note downloads use tenant-safe signing.
3. **RESOLVED FOR IMPLEMENTED PRIVATE TYPES:** private entity types are
   allowlisted and note/assignment/submission roles are checked. Assignment and
   submission registration flows still require their own authorization checks.
4. **RESOLVED FOR DOCUMENT UPLOADS:** declared MIME and extension must agree,
   and the uploaded object's size, content type, and leading file signature are
   checked before note registration.
5. **RESOLVED:** documented routes are implemented; old routes remain as
   compatibility aliases for now.
6. **RESOLVED:** programme enrolment is compared with the requested course's
   programme inside the same school.
7. Note creation happens only after the R2 PUT. If database registration fails,
   the uploaded object is orphaned. This is accepted for deleted notes in the
   MVP documentation, but failed registrations also need cleanup or tracking.
8. Note deletion removes only the database record. The R2 object remains for a
   future cleanup job, as documented for MVP.
9. **PARTIAL:** focused policy tests now cover configuration completeness,
   entity allowlisting, scoped keys, tenant rejection, file metadata rules, and
   database file-type normalization. Live R2 integration and cleanup tests still
   require the development bucket credentials.

## Verification performed

- API TypeScript build passed.
- API test suite passed: 69 tests with zero failures after the public-media
  backend slice.
- The tests do not currently exercise a real or emulated R2 bucket.
- API and web TypeScript checks passed after the first R2 slice.
- A disposable PDF object was uploaded through a presigned PUT URL, verified by
  metadata and byte-for-byte signed GET, deleted in a `finally` cleanup path,
  and confirmed absent afterward.
- Browser CORS preflight returned HTTP 204; PUT and GET returned HTTP 200.
- A second disposable live test used the production storage module and a key
  bound to a generated assignment ID. Correct-context verification succeeded,
  verification with a different assignment ID was rejected, and the object was
  deleted and confirmed absent.

## Recommended order when resuming

1. **COMPLETE:** configure and verify the development R2 bucket, credentials,
   CORS, disposable upload, signed download, and cleanup.
2. **COMPLETE FOR NOTES:** restrict and validate upload intents by entity type, role, school, course,
   size, and permitted extension/MIME combination.
3. Add a confirmation endpoint that verifies the uploaded object before storing
   its key, including actual-content validation where required.
4. Centralize tenant-safe download authorization and remove direct use of the
   unrestricted signing helper from feature routes.
5. Add R2 integration tests using disposable, explicitly prefixed test objects,
   with cleanup in `finally` blocks.
6. Verify the notes flow end to end.
7. Implement assignments and submissions.
8. Move or intentionally classify programme thumbnails, school branding,
   promos, profile photos, avatars, video intros, and presentation slides.
9. Add orphan-object cleanup and monitoring.

Do not mark this checkpoint complete until a real test upload, database
registration, authorized download, unauthorized cross-tenant rejection, and
cleanup have all been verified.
