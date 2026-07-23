# Kanvise — Full API Specification
**Version:** 1.0  
**Prepared by:** Architecture Team  
**Date:** June 2026  
**Status:** Approved — Contract Between Frontend and Backend

---

## Purpose

This document defines every API endpoint in the Kanvise system. It is the contract between the frontend and backend teams. No endpoint should exist in the codebase that is not defined here. Any new endpoint requires this document to be updated and approved first.

All authenticated endpoints require a valid JWT in the `Authorization: Bearer <token>` header. All responses are JSON. All timestamps are ISO 8601 UTC strings. All IDs are UUIDs unless stated otherwise.

---

## Conventions

**Base URLs:**
- Hono API (Scaleway): `https://api.kanvise.com`
- Next.js Route Handlers (Vercel): `https://kanvise.com/api`

**Role shorthand used in this document:**
- `A` = Admin
- `T` = Tutor
- `S` = Student
- `*` = Any authenticated user
- `PUBLIC` = No authentication required

**Standard error response shape:**
```json
{
  "error": "Human readable message",
  "code": "ERROR_CODE_CONSTANT"
}
```

**Standard success response shape:**
```json
{
  "data": { },
  "message": "Optional success message"
}
```

---

## Module 1 — Authentication

All auth routes are handled by Supabase Auth on the frontend directly, except where noted. The Hono backend does not expose login/register endpoints — Supabase handles credential management. The Next.js layer handles auth callbacks.

---

### POST `/api/auth/callback`
**Host:** Next.js | **Auth:** PUBLIC

Supabase Auth callback handler. Called automatically after email confirmation or OAuth. Exchanges the code for a session and sets the auth cookie. After the session is established, calls Hono to ensure a user profile record exists for the authenticated user.

**Query params:**
```
code: string   (from Supabase)
next: string   (redirect path after auth)
```

**Behaviour:** On first login after registration, Hono creates the `user_profiles` record with the role and school context. On subsequent logins, it is a no-op.

---

### POST `api.kanvise.com/auth/profile/init`
**Host:** Hono | **Auth:** `*` (any freshly authenticated user)

Called by the Next.js auth callback after a new user verifies their email. Creates the `user_profiles` record if it does not already exist.

**Request body:**
```json
{
  "supabase_auth_id": "uuid",
  "role": "admin | tutor | student",
  "first_name": "string",
  "last_name": "string",
  "email": "string",
  "school_id": "uuid | null",
  "invite_token": "string | null"
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "kanvise_user_id": "KNV-ADM-00001",
    "role": "admin",
    "school_id": "uuid | null"
  }
}
```

**Notes:** `school_id` is null for Admins who have not yet created their school. `invite_token` is present for Tutors — used to link them to the correct school automatically.

---

### GET `api.kanvise.com/auth/me`
**Host:** Hono | **Auth:** `*`

Returns the current authenticated user's full profile.

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "kanvise_user_id": "KNV-STU-00042",
    "role": "student",
    "school_id": "uuid",
    "first_name": "string",
    "last_name": "string",
    "email": "string",
    "bio": "string | null",
    "profile_photo_url": "string | null",
    "avatar": { }
  }
}
```

---

### PATCH `api.kanvise.com/auth/me`
**Host:** Hono | **Auth:** `*`

Updates the current user's profile fields.

**Request body (all fields optional):**
```json
{
  "first_name": "string",
  "last_name": "string",
  "bio": "string",
  "profile_photo_key": "string"
}
```

**Response 200:** Updated user profile object.

---

## Module 2 — Schools

---

### POST `api.kanvise.com/schools`
**Host:** Hono | **Auth:** `A`

Creates a new school for the authenticated Admin. Called immediately after Admin registration. One Admin can only have one school — returns 409 if school already exists for this Admin.

**Request body:**
```json
{
  "name": "string",
  "slug": "string",
  "description": "string | null"
}
```

**Response 201:**
```json
{
  "data": {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "description": "string | null",
    "is_active": true,
    "created_at": "timestamp"
  }
}
```

**Errors:** `409 SCHOOL_ALREADY_EXISTS`, `409 SLUG_TAKEN`

---

### GET `api.kanvise.com/schools/me`
**Host:** Hono | **Auth:** `A`

Returns the Admin's own school profile in full including all settings.

**Response 200:** Full school object including all URLs, contact info, social links, and Paystack subaccount status.

---

### PATCH `api.kanvise.com/schools/me`
**Host:** Hono | **Auth:** `A`

Updates school profile fields.

**Request body (all fields optional):**
```json
{
  "name": "string",
  "description": "string",
  "contact_email": "string",
  "contact_phone": "string",
  "website_url": "string",
  "instagram_url": "string",
  "twitter_url": "string",
  "facebook_url": "string",
  "whatsapp_number": "string",
  "logo_key": "string",
  "banner_key": "string",
  "video_intro_key": "string | null"
}
```

**Response 200:** Updated school object.

---

### DELETE `api.kanvise.com/schools/me/video-intro`
**Host:** Hono | **Auth:** `A`

Removes the video intro from the school profile. Sets `video_intro_url` to null. Does not delete the R2 file — that is handled separately via storage cleanup.

**Response 200:**
```json
{ "message": "Video intro removed" }
```

---

### POST `api.kanvise.com/schools/me/invite/tutor`
**Host:** Hono | **Auth:** `A`

Generates a signed invite link for a tutor. The link contains a short-lived token that pre-links the tutor to this school on registration.

**Request body:**
```json
{
  "email": "string | null"
}
```

**Response 201:**
```json
{
  "data": {
    "invite_url": "https://kanvise.com/join?token=xxxx",
    "expires_at": "timestamp"
  }
}
```

**Notes:** If `email` is provided, Resend sends the invite link directly. If null, the URL is returned for the Admin to share manually.

---

## Module 3 — Users & Tutors

---

### GET `api.kanvise.com/schools/me/users`
**Host:** Hono | **Auth:** `A`

Lists all users in the school. Supports filtering by role.

**Query params:**
```
role: admin | tutor | student   (optional)
page: integer                   (default 1)
limit: integer                  (default 20)
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "kanvise_user_id": "string",
      "role": "string",
      "first_name": "string",
      "last_name": "string",
      "email": "string",
      "profile_photo_url": "string | null",
      "created_at": "timestamp"
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 20 }
}
```

---

### GET `api.kanvise.com/schools/me/tutors`
**Host:** Hono | **Auth:** `A`

Lists all tutors in the school with their assigned courses.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "first_name": "string",
      "last_name": "string",
      "bio": "string | null",
      "profile_photo_url": "string | null",
      "courses": [
        { "id": "uuid", "name": "string" }
      ]
    }
  ]
}
```

---

### GET `api.kanvise.com/users/:userId`
**Host:** Hono | **Auth:** `A`

Returns a single user's profile. Admin can view any user in their school.

**Response 200:** Full user profile object.

**Errors:** `404 USER_NOT_FOUND`, `403 NOT_IN_SCHOOL`

---

### DELETE `api.kanvise.com/schools/me/users/:userId`
**Host:** Hono | **Auth:** `A`

Removes a user from the school. Deactivates their profile — does not delete it. Their historical data (attendance, submissions, results) is preserved.

**Response 200:**
```json
{ "message": "User removed from school" }
```

**Errors:** `403 CANNOT_REMOVE_SELF`, `404 USER_NOT_FOUND`

---

## Module 4 — Avatar

---

### GET `api.kanvise.com/users/me/avatar`
**Host:** Hono | **Auth:** `*`

Returns the current user's avatar configuration.

**Response 200:**
```json
{
  "data": {
    "skin_tone": "string",
    "face_shape": "string",
    "hair_style": "string",
    "hair_colour": "string",
    "outfit_colour": "string",
    "accessory": "string | null",
    "headwear": "string | null"
  }
}
```

---

### PUT `api.kanvise.com/users/me/avatar`
**Host:** Hono | **Auth:** `*`

Creates or replaces the current user's avatar configuration. Full replacement — all fields required.

**Request body:**
```json
{
  "skin_tone": "string",
  "face_shape": "string",
  "hair_style": "string",
  "hair_colour": "string",
  "outfit_colour": "string",
  "accessory": "string | null",
  "headwear": "string | null"
}
```

**Response 200:** Updated avatar config object.

---

## Module 5 — Programmes

---

### POST `api.kanvise.com/programmes`
**Host:** Hono | **Auth:** `A`

Creates a new programme for the school.

**Request body:**
```json
{
  "name": "string",
  "slug": "string",
  "description": "string | null",
  "price": 15000.00,
  "currency": "NGN",
  "thumbnail_key": "string | null"
}
```

**Response 201:** Full programme object.

**Errors:** `409 SLUG_TAKEN`

---

### GET `api.kanvise.com/programmes`
**Host:** Hono | **Auth:** `A, T`

Lists all programmes for the school. Admin sees all. Tutor sees programmes that contain courses they are assigned to.

**Query params:**
```
is_published: boolean   (optional filter)
```

**Response 200:** Array of programme objects.

---

### GET `api.kanvise.com/programmes/:id`
**Host:** Hono | **Auth:** `A, T`

Returns a single programme with its sub-programmes and courses.

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "description": "string | null",
    "price": 15000.00,
    "is_published": true,
    "sub_programmes": [ ],
    "courses": [ ],
    "enrolled_count": 124
  }
}
```

---

### PATCH `api.kanvise.com/programmes/:id`
**Host:** Hono | **Auth:** `A`

Updates a programme's details.

**Request body (all optional):**
```json
{
  "name": "string",
  "description": "string",
  "price": 18000.00,
  "thumbnail_key": "string"
}
```

**Response 200:** Updated programme object.

---

### POST `api.kanvise.com/programmes/:id/publish`
**Host:** Hono | **Auth:** `A`

Sets `is_published = true`. Programme becomes visible on the public school page.

**Response 200:**
```json
{ "message": "Programme published" }
```

**Errors:** `400 NO_COURSES_IN_PROGRAMME` — a programme must have at least one course before it can be published.

---

### POST `api.kanvise.com/programmes/:id/unpublish`
**Host:** Hono | **Auth:** `A`

Sets `is_published = false`. Hides from public page. Does not affect existing enrolments.

**Response 200:**
```json
{ "message": "Programme unpublished" }
```

---

### DELETE `api.kanvise.com/programmes/:id`
**Host:** Hono | **Auth:** `A`

Soft-deletes a programme. Cannot delete if active enrolments exist.

**Errors:** `409 ACTIVE_ENROLMENTS_EXIST`

---

## Module 6 — Sub-Programmes

---

### POST `api.kanvise.com/programmes/:programmeId/sub-programmes`
**Host:** Hono | **Auth:** `A`

Creates a sub-programme under a programme.

**Request body:**
```json
{
  "name": "string",
  "slug": "string",
  "description": "string | null",
  "price": 8000.00
}
```

**Response 201:** Full sub-programme object.

---

### GET `api.kanvise.com/programmes/:programmeId/sub-programmes`
**Host:** Hono | **Auth:** `A, T`

Lists all sub-programmes under a programme.

**Response 200:** Array of sub-programme objects with their courses.

---

### PATCH `api.kanvise.com/sub-programmes/:id`
**Host:** Hono | **Auth:** `A`

Updates a sub-programme.

---

### POST `api.kanvise.com/sub-programmes/:id/publish`
**Host:** Hono | **Auth:** `A`

Publishes the sub-programme.

---

### DELETE `api.kanvise.com/sub-programmes/:id`
**Host:** Hono | **Auth:** `A`

Soft-deletes. Cannot delete if active enrolments exist.

---

## Module 7 — Courses

---

### POST `api.kanvise.com/courses`
**Host:** Hono | **Auth:** `A`

Creates a course. Specify `programme_id` for a course directly under a programme, `sub_programme_id` for a course under a sub-programme, or neither for a standalone course.

**Request body:**
```json
{
  "name": "string",
  "slug": "string",
  "description": "string | null",
  "price": 5000.00,
  "programme_id": "uuid | null",
  "sub_programme_id": "uuid | null"
}
```

**Response 201:** Full course object.

**Errors:** `400 INVALID_PARENT` — if both `programme_id` and `sub_programme_id` are set simultaneously.

---

### GET `api.kanvise.com/courses`
**Host:** Hono | **Auth:** `A, T`

Lists all courses in the school.

**Query params:**
```
programme_id: uuid      (filter by programme)
sub_programme_id: uuid  (filter by sub-programme)
standalone: boolean     (filter standalone courses only)
is_published: boolean
```

**Response 200:** Array of course objects.

---

### GET `api.kanvise.com/courses/:id`
**Host:** Hono | **Auth:** `A, T, S`

Returns a single course with its content summary (note count, assignment count, mock count, upcoming live classes).

**Student access:** Only if enrolled. Returns `403 NOT_ENROLLED` if not.

---

### PATCH `api.kanvise.com/courses/:id`
**Host:** Hono | **Auth:** `A`

Updates course details.

---

### POST `api.kanvise.com/courses/:id/publish`
**Host:** Hono | **Auth:** `A`

Publishes the course to the public page.

---

### DELETE `api.kanvise.com/courses/:id`
**Host:** Hono | **Auth:** `A`

Soft-deletes. Cannot delete if active enrolments exist.

---

### POST `api.kanvise.com/courses/:courseId/tutors`
**Host:** Hono | **Auth:** `A`

Assigns a tutor to a course.

**Request body:**
```json
{ "tutor_id": "uuid" }
```

**Response 201:**
```json
{ "message": "Tutor assigned to course" }
```

**Errors:** `404 TUTOR_NOT_FOUND`, `409 ALREADY_ASSIGNED`, `400 NOT_A_TUTOR`

---

### DELETE `api.kanvise.com/courses/:courseId/tutors/:tutorId`
**Host:** Hono | **Auth:** `A`

Removes a tutor from a course.

---

### GET `api.kanvise.com/courses/:courseId/tutors`
**Host:** Hono | **Auth:** `A, T`

Lists all tutors assigned to a course.

---

## Module 8 — Public Pages

All routes in this module require no authentication. All are read-only.

---

### GET `api.kanvise.com/public/schools/:slug`
**Host:** Hono | **Auth:** PUBLIC

Returns the full public page data for a tutorial centre.

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "description": "string | null",
    "logo_url": "string | null",
    "banner_url": "string | null",
    "video_intro_url": "string | null",
    "contact_email": "string | null",
    "contact_phone": "string | null",
    "website_url": "string | null",
    "instagram_url": "string | null",
    "twitter_url": "string | null",
    "facebook_url": "string | null",
    "whatsapp_number": "string | null",
    "enrolled_count": 340,
    "programmes": [
      {
        "id": "uuid",
        "name": "string",
        "slug": "string",
        "price": 15000.00,
        "thumbnail_url": "string | null",
        "enrolled_count": 120,
        "average_rating": 4.7
      }
    ],
    "standalone_courses": [ ],
    "tutors": [
      {
        "id": "uuid",
        "first_name": "string",
        "last_name": "string",
        "bio": "string | null",
        "profile_photo_url": "string | null",
        "subjects": ["Chemistry", "Biology"]
      }
    ],
    "promos": [
      {
        "id": "uuid",
        "title": "string",
        "image_url": "string",
        "link_type": "programme",
        "link_slug": "string"
      }
    ]
  }
}
```

**Errors:** `404 SCHOOL_NOT_FOUND`

---

### GET `api.kanvise.com/public/programmes/:id`
**Host:** Hono | **Auth:** PUBLIC

Returns the full public page data for a programme — used for the enrolment/marketing page.

**Response 200:**
```json
{
  "data": {
    "id": "uuid",
    "name": "string",
    "slug": "string",
    "description": "string | null",
    "price": 15000.00,
    "currency": "NGN",
    "enrolled_count": 120,
    "school": {
      "id": "uuid",
      "name": "string",
      "slug": "string"
    },
    "sub_programmes": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string | null",
        "courses": [ { "id": "uuid", "name": "string" } ]
      }
    ],
    "courses": [ ],
    "tutors": [ ],
    "reviews": [
      {
        "id": "uuid",
        "rating": 5,
        "review_text": "string | null",
        "student_name": "string",
        "created_at": "timestamp"
      }
    ],
    "average_rating": 4.7,
    "review_count": 34
  }
}
```

---

### GET `api.kanvise.com/public/sub-programmes/:id`
**Host:** Hono | **Auth:** PUBLIC

Returns the public page data for a sub-programme.

---

### GET `api.kanvise.com/public/courses/:id`
**Host:** Hono | **Auth:** PUBLIC

Returns the public page data for a standalone course.

---

## Module 9 — Enrolments & Payments

---

### POST `api.kanvise.com/enrolments/initiate`
**Host:** Hono | **Auth:** `S`

Initiates a payment for a programme, sub-programme, or course. Creates a pending payment record and returns a Paystack payment URL.

**Request body:**
```json
{
  "programme_id": "uuid | null",
  "sub_programme_id": "uuid | null",
  "course_id": "uuid | null"
}
```

**Response 201:**
```json
{
  "data": {
    "payment_id": "uuid",
    "paystack_reference": "string",
    "payment_url": "https://checkout.paystack.com/xxxx",
    "amount": 15500.00,
    "breakdown": {
      "programme_price": 15000.00,
      "kanvise_fee": 500.00
    }
  }
}
```

**Errors:** `409 ALREADY_ENROLLED`, `400 INVALID_ENROLMENT_TARGET`, `404 PROGRAMME_NOT_FOUND`

---

### POST `/api/webhooks/paystack`
**Host:** Next.js | **Auth:** PUBLIC (signature-verified)

Receives Paystack webhook events. Verifies the `x-paystack-signature` header using HMAC-SHA512. On valid `charge.success` event, forwards to Hono for processing.

**Headers:**
```
x-paystack-signature: string
```

**Handled events:** `charge.success`, `charge.failed`

**Response:** Always returns `200` immediately to Paystack. Processing happens asynchronously.

---

### POST `api.kanvise.com/internal/payments/confirm`
**Host:** Hono | **Auth:** Internal (called by Next.js webhook handler only, verified by shared secret)

Processes a confirmed payment. Creates the enrolment record, grants access, sends emails.

**Request body:**
```json
{
  "paystack_reference": "string",
  "paystack_transaction_id": "string"
}
```

**Response 200:**
```json
{ "message": "Enrolment created and access granted" }
```

---

### GET `api.kanvise.com/enrolments`
**Host:** Hono | **Auth:** `S`

Returns the current student's enrolments.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "enrolled_at": "timestamp",
      "type": "programme | sub_programme | course",
      "programme": { "id": "uuid", "name": "string" },
      "sub_programme": null,
      "course": null,
      "payment": {
        "amount": 15500.00,
        "paid_at": "timestamp"
      }
    }
  ]
}
```

---

### GET `api.kanvise.com/payments`
**Host:** Hono | **Auth:** `A, S`

Admin: returns all payments for the school. Student: returns own payments only.

**Query params (Admin only):**
```
status: pending | successful | failed
student_id: uuid
page: integer
limit: integer
```

**Response 200:** Array of payment objects with student details (Admin) or own details (Student).

---

### GET `api.kanvise.com/payments/:id`
**Host:** Hono | **Auth:** `A, S`

Returns a single payment. Student can only view their own.

---

## Module 10 — Live Classes

---

### POST `api.kanvise.com/live-classes`
**Host:** Hono | **Auth:** `A, T`

Schedules a new live class.

**Request body:**
```json
{
  "course_id": "uuid",
  "tutor_id": "uuid",
  "title": "string",
  "scheduled_at": "timestamp",
  "duration_minutes": 60
}
```

**Response 201:** Full live class object.

**Errors:** `403 TUTOR_NOT_ASSIGNED_TO_COURSE`, `400 SCHEDULED_IN_PAST`

---

### GET `api.kanvise.com/live-classes`
**Host:** Hono | **Auth:** `A, T, S`

Lists live classes. Filtered automatically by role.

- Admin: sees all classes for the school
- Tutor: sees only their classes
- Student: sees classes for their enrolled courses only

**Query params:**
```
course_id: uuid
status: scheduled | live | completed | cancelled
from: timestamp
to: timestamp
page: integer
limit: integer
```

**Response 200:** Array of live class objects.

---

### GET `api.kanvise.com/live-classes/:id`
**Host:** Hono | **Auth:** `A, T, S`

Returns a single live class. Student access requires enrolment in the relevant course.

---

### PATCH `api.kanvise.com/live-classes/:id`
**Host:** Hono | **Auth:** `A, T`

Updates a scheduled class (title, time, duration). Cannot update a class that is `live` or `completed`.

---

### DELETE `api.kanvise.com/live-classes/:id`
**Host:** Hono | **Auth:** `A`

Cancels a scheduled class. Sets `status = cancelled`.

---

### POST `api.kanvise.com/live-classes/:id/start`
**Host:** Hono | **Auth:** `T`

Called when the tutor clicks Start Class. Creates the LiveKit room, generates host token, updates class status to `live`.

**Response 200:**
```json
{
  "data": {
    "livekit_room_name": "string",
    "access_token": "string",
    "livekit_url": "wss://livekit.kanvise.com"
  }
}
```

**Errors:** `403 NOT_CLASS_TUTOR`, `409 ALREADY_LIVE`, `400 CLASS_NOT_SCHEDULED`

---

### POST `api.kanvise.com/live-classes/:id/join`
**Host:** Hono | **Auth:** `S, T`

Called when a participant clicks Join Class. Verifies enrolment (for students), generates a LiveKit participant token.

**Response 200:**
```json
{
  "data": {
    "livekit_room_name": "string",
    "access_token": "string",
    "livekit_url": "wss://livekit.kanvise.com"
  }
}
```

**Errors:** `403 NOT_ENROLLED`, `404 CLASS_NOT_LIVE`

---

### POST `api.kanvise.com/live-classes/:id/end`
**Host:** Hono | **Auth:** `T`

Ends a live class. Calls LiveKit SDK to close the room. Sets `status = completed` and `ended_at`.

**Response 200:**
```json
{ "message": "Live class ended" }
```

---

### POST `api.kanvise.com/webhooks/livekit`
**Host:** Hono | **Auth:** Internal (LiveKit webhook secret)

Receives LiveKit participant events over the private Scaleway network. Processes `participant_joined` and `participant_left` events to record attendance.

**Payload (from LiveKit):**
```json
{
  "event": "participant_joined | participant_left",
  "room": { "name": "string" },
  "participant": {
    "identity": "kanvise_user_id",
    "joined_at": 1234567890
  }
}
```

**Behaviour on `participant_joined`:** Creates attendance record with `joined_at`.
**Behaviour on `participant_left`:** Updates attendance record with `left_at` and calculates `duration_seconds`.

**Response:** Always `200`.

---

## Module 11 — Attendance

---

### GET `api.kanvise.com/live-classes/:id/attendance`
**Host:** Hono | **Auth:** `A, T`

Returns attendance records for a specific live class.

**Response 200:**
```json
{
  "data": [
    {
      "student_id": "uuid",
      "student_name": "string",
      "joined_at": "timestamp",
      "left_at": "timestamp | null",
      "duration_seconds": 3240,
      "duration_formatted": "54 min"
    }
  ],
  "summary": {
    "total_enrolled": 45,
    "total_attended": 38,
    "attendance_rate": 84.4
  }
}
```

---

### GET `api.kanvise.com/students/:studentId/attendance`
**Host:** Hono | **Auth:** `A, T, S`

Returns attendance history for a student across all their live classes. Student can only access their own.

**Query params:**
```
course_id: uuid   (optional filter)
```

---

### GET `api.kanvise.com/students/me/attendance`
**Host:** Hono | **Auth:** `S`

Shorthand — returns the current student's own attendance history.

---

## Module 12 — Notes

---

### POST `api.kanvise.com/courses/:courseId/notes`
**Host:** Hono | **Auth:** `T`

Creates a note record after the file has been uploaded to R2.

**Request body:**
```json
{
  "title": "string",
  "description": "string | null",
  "file_key": "string",
  "file_name": "string",
  "file_type": "pdf | docx | pptx | jpg | png",
  "file_size_bytes": 204800
}
```

**Response 201:** Full note object.

**Errors:** `403 NOT_ASSIGNED_TO_COURSE`

---

### GET `api.kanvise.com/courses/:courseId/notes`
**Host:** Hono | **Auth:** `T, S`

Lists all notes for a course.

**Student access:** Requires enrolment in the course.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "string",
      "description": "string | null",
      "file_name": "string",
      "file_type": "string",
      "file_size_bytes": 204800,
      "download_url": "https://presigned-r2-url",
      "tutor": { "id": "uuid", "first_name": "string", "last_name": "string" },
      "created_at": "timestamp"
    }
  ]
}
```

---

### DELETE `api.kanvise.com/notes/:id`
**Host:** Hono | **Auth:** `T, A`

Deletes a note record. Does not delete the R2 file — that is handled by a separate storage cleanup job.

---

## Module 13 — Storage (Presigned URLs)

---

### POST `api.kanvise.com/storage/presign/upload`
**Host:** Hono | **Auth:** `*`

Generates a presigned R2 PUT URL for a file upload. Validates file type and size before generating. Returns the presigned URL and the file key to use when confirming the upload.

**Request body:**
```json
{
  "file_name": "string",
  "content_type": "application/pdf",
  "file_size_bytes": 204800,
  "entity_type": "note | submission | assignment_attachment | banner | logo | promo | video_intro | profile_photo"
}
```

**Response 200:**
```json
{
  "data": {
    "presigned_url": "https://r2-presigned-put-url",
    "file_key": "schools/uuid/notes/uuid.pdf",
    "expires_in_seconds": 900
  }
}
```

**Errors:** `400 INVALID_FILE_TYPE`, `400 FILE_TOO_LARGE`

---

### GET `api.kanvise.com/storage/presign/download`
**Host:** Hono | **Auth:** `*`

Generates a short-lived presigned R2 GET URL for a private file. Verifies the requesting user's school_id matches the file's school before generating.

**Query params:**
```
file_key: string
```

**Response 200:**
```json
{
  "data": {
    "download_url": "https://r2-presigned-get-url",
    "expires_in_seconds": 900
  }
}
```

**Errors:** `403 FORBIDDEN`, `404 FILE_NOT_FOUND`

---

## Module 14 — Assignments

---

### POST `api.kanvise.com/courses/:courseId/assignments`
**Host:** Hono | **Auth:** `T`

Creates an assignment for a course.

**Request body:**
```json
{
  "title": "string",
  "description": "string",
  "deadline_at": "timestamp",
  "attachment_file_key": "string | null",
  "attachment_file_name": "string | null"
}
```

**Response 201:** Full assignment object.

**Errors:** `403 NOT_ASSIGNED_TO_COURSE`, `400 DEADLINE_IN_PAST`

---

### GET `api.kanvise.com/courses/:courseId/assignments`
**Host:** Hono | **Auth:** `T, S`

Lists all published assignments for a course. Students must be enrolled.

**Response 200:** Array of assignment objects with deadline countdown and submission status for students.

---

### GET `api.kanvise.com/assignments/:id`
**Host:** Hono | **Auth:** `T, S`

Returns a single assignment with full details.

---

### PATCH `api.kanvise.com/assignments/:id`
**Host:** Hono | **Auth:** `T`

Updates an assignment. Cannot update after any student has submitted.

---

### POST `api.kanvise.com/assignments/:id/publish`
**Host:** Hono | **Auth:** `T`

Publishes the assignment — makes it visible to enrolled students.

---

### DELETE `api.kanvise.com/assignments/:id`
**Host:** Hono | **Auth:** `A, T`

Soft-deletes. Cannot delete if submissions exist.

---

## Module 15 — Submissions

---

### POST `api.kanvise.com/assignments/:assignmentId/submit`
**Host:** Hono | **Auth:** `S`

Submits a student's assignment. One submission per student per assignment.

**Request body:**
```json
{
  "file_key": "string",
  "file_name": "string"
}
```

**Response 201:** Submission confirmation object.

**Errors:** `409 ALREADY_SUBMITTED`, `400 DEADLINE_PASSED`, `403 NOT_ENROLLED`

---

### GET `api.kanvise.com/assignments/:assignmentId/submissions`
**Host:** Hono | **Auth:** `T, A`

Lists all submissions for an assignment.

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "student": { "id": "uuid", "first_name": "string", "last_name": "string" },
      "file_name": "string",
      "download_url": "string",
      "submitted_at": "timestamp",
      "score": 85.0,
      "feedback": "string | null",
      "reviewed_at": "timestamp | null"
    }
  ],
  "summary": {
    "total_enrolled": 45,
    "total_submitted": 38,
    "total_reviewed": 20
  }
}
```

---

### PATCH `api.kanvise.com/submissions/:id/review`
**Host:** Hono | **Auth:** `T`

Tutor grades and leaves feedback on a submission.

**Request body:**
```json
{
  "score": 85.0,
  "feedback": "string | null"
}
```

**Response 200:** Updated submission object.

---

### GET `api.kanvise.com/students/me/submissions`
**Host:** Hono | **Auth:** `S`

Returns all of the current student's submissions across all courses.

---

## Module 16 — Mock Exams

> **Implementation transition (July 2026):** The versioned question-bank and CBT
> contracts in `15_MOCK_ENGINE_AND_QUESTION_BANK_IMPLEMENTATION_PLAN.md` supersede
> the legacy direct-question attempt contract below. Tutor CRUD/results remain the
> current implementation. Student start, resume, autosave, timeout, and results
> endpoints in this section are planned contracts until their versioned Hono routes
> and tests land; documentation alone must not be treated as implementation.

### Question-bank authoring checkpoint

The Hono service now exposes the first authoring contract, pending application of
the question-bank migrations in the target environment:

- `GET /question-banks` — list private banks owned by the tutor and centre banks
  visible to the tutor; admins see all active banks in their centre.
- `POST /question-banks` — create a private or centre bank.
- `GET /question-banks/:bankId` — load accessible bank metadata.
- `PATCH /question-banks/:bankId` — owner/admin rename, visibility, description,
  or archive changes.
- `GET /question-banks/:bankId/questions` — paginated search by text, subject,
  topic, type, or course.
- `POST /question-banks/:bankId/questions` — atomically create the source question,
  immutable version, and answer options.
- `PATCH /question-banks/questions/:questionId` — author/admin creates a new
  immutable version rather than rewriting history.
- `GET /question-banks/questions/:questionId/versions` — accessible version history.
- `POST /storage/presign/upload` with `entity_type = question_media` and `bank_id`
  — issue a private, bank-scoped R2 upload intent after tutor/admin bank access.
- `POST /question-banks/media/confirm` — verify the stored image signature and
  metadata, require alternative text, and register immutable media metadata.
- `GET /question-banks/media/:mediaId/url?bank_id=:bankId` — return a short-lived
  signed URL after school and bank access checks.

These routes are tutor/admin-only and always scope queries to the verified profile's
`school_id`. Next.js does not query the question-bank tables directly.

---

### POST `api.kanvise.com/courses/:courseId/mocks`
**Host:** Hono | **Auth:** `T`

Creates a new mock exam in draft status.

**Request body:**
```json
{
  "title": "string",
  "description": "string | null",
  "time_limit_minutes": 60,
  "publish_at": "timestamp | null"
}
```

**Response 201:** Full mock exam object.

**Errors:** `403 NOT_ASSIGNED_TO_COURSE`

---

### GET `api.kanvise.com/courses/:courseId/mocks`
**Host:** Hono | **Auth:** `T, A, S`

Lists mock exams for a course.

- Tutor/Admin: sees all statuses (draft, published, archived)
- Student: sees only published mocks for enrolled courses

---

### GET `api.kanvise.com/mocks/:id`
**Host:** Hono | **Auth:** `T, A, S`

Returns a mock exam. Questions are returned for Tutor/Admin. For Students, questions are returned only when starting an attempt — not on this endpoint.

---

### PATCH `api.kanvise.com/mocks/:id`
**Host:** Hono | **Auth:** `T`

Updates a mock. Cannot update a published mock if any student has already attempted it.

---

### POST `api.kanvise.com/mocks/:id/publish`
**Host:** Hono | **Auth:** `T`

Immediately publishes a mock (sets `status = published`, clears `publish_at`).

**Errors:** `400 NO_QUESTIONS` — must have at least one question.

---

### DELETE `api.kanvise.com/mocks/:id`
**Host:** Hono | **Auth:** `T, A`

Archives a mock (sets `status = archived`). Cannot hard-delete if attempts exist.

---

### POST `api.kanvise.com/mocks/:mockId/questions`
**Host:** Hono | **Auth:** `T`

Adds a question to a mock.

**Request body:**
```json
{
  "question_type": "mcq | theory",
  "question_text": "string",
  "marks": 2,
  "order_index": 1,
  "options": [
    { "option_text": "string", "is_correct": false, "order_index": 1 },
    { "option_text": "string", "is_correct": true, "order_index": 2 },
    { "option_text": "string", "is_correct": false, "order_index": 3 },
    { "option_text": "string", "is_correct": false, "order_index": 4 }
  ]
}
```

**Notes:** `options` is required for MCQ questions, ignored for theory. Exactly one option must have `is_correct: true` for MCQ.

**Response 201:** Full question object with options.

**Errors:** `400 MCQ_REQUIRES_OPTIONS`, `400 MCQ_MUST_HAVE_ONE_CORRECT_OPTION`

---

### PATCH `api.kanvise.com/mocks/:mockId/questions/:questionId`
**Host:** Hono | **Auth:** `T`

Updates a question.

---

### DELETE `api.kanvise.com/mocks/:mockId/questions/:questionId`
**Host:** Hono | **Auth:** `T`

Deletes a question and its options.

---

### POST `api.kanvise.com/mocks/:mockId/attempts`
**Host:** Hono | **Auth:** `S`

Starts a student's attempt on a mock. Creates an attempt record and returns the questions (without `is_correct`).

**Response 201:**
```json
{
  "data": {
    "attempt_id": "uuid",
    "started_at": "timestamp",
    "time_limit_minutes": 60,
    "questions": [
      {
        "id": "uuid",
        "question_type": "mcq",
        "question_text": "string",
        "marks": 2,
        "order_index": 1,
        "options": [
          { "id": "uuid", "option_text": "string", "order_index": 1 }
        ]
      }
    ]
  }
}
```

**Errors:** `409 ATTEMPT_ALREADY_EXISTS`, `403 NOT_ENROLLED`, `404 MOCK_NOT_PUBLISHED`

---

### POST `api.kanvise.com/attempts/:attemptId/submit`
**Host:** Hono | **Auth:** `S`

Submits a mock attempt. Hono auto-grades MCQ answers, stores theory answers.

**Request body:**
```json
{
  "answers": [
    {
      "question_id": "uuid",
      "selected_option_id": "uuid | null",
      "theory_answer_text": "string | null"
    }
  ]
}
```

**Response 200:**
```json
{
  "data": {
    "attempt_id": "uuid",
    "status": "submitted",
    "mcq_score": 14,
    "total_mcq_questions": 20,
    "correct_mcq_answers": 14,
    "mcq_percentage": 70.0,
    "theory_questions_pending_review": 3
  }
}
```

**Errors:** `409 ALREADY_SUBMITTED`, `404 ATTEMPT_NOT_FOUND`

---

### GET `api.kanvise.com/mocks/:mockId/results`
**Host:** Hono | **Auth:** `T, A`

Returns all student results for a mock.

**Response 200:**
```json
{
  "data": [
    {
      "student": { "id": "uuid", "first_name": "string", "last_name": "string" },
      "attempt_id": "uuid",
      "status": "submitted",
      "mcq_score": 14,
      "total_mcq_questions": 20,
      "submitted_at": "timestamp",
      "time_taken_seconds": 2340
    }
  ],
  "summary": {
    "total_attempts": 38,
    "average_mcq_score": 12.4,
    "highest_score": 20,
    "lowest_score": 5
  }
}
```

---

### GET `api.kanvise.com/attempts/:attemptId/results`
**Host:** Hono | **Auth:** `S, T, A`

Returns detailed results for a specific attempt including per-question breakdown.

---

### PATCH `api.kanvise.com/mock-answers/:answerId/grade`
**Host:** Hono | **Auth:** `T`

Tutor grades a theory answer.

**Request body:**
```json
{
  "tutor_score": 8.5,
  "tutor_feedback": "string | null"
}
```

**Response 200:** Updated answer object.

---

## Module 17 — Notifications

---

### GET `api.kanvise.com/notifications`
**Host:** Hono | **Auth:** `*`

Returns notifications for the current user. Most recent first.

**Query params:**
```
is_read: boolean   (optional filter)
limit: integer     (default 20)
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "live_class_reminder",
      "title": "string",
      "body": "string",
      "is_read": false,
      "related_entity_type": "live_class",
      "related_entity_id": "uuid",
      "created_at": "timestamp"
    }
  ],
  "unread_count": 5
}
```

---

### PATCH `api.kanvise.com/notifications/:id/read`
**Host:** Hono | **Auth:** `*`

Marks a notification as read.

---

### POST `api.kanvise.com/notifications/read-all`
**Host:** Hono | **Auth:** `*`

Marks all of the current user's notifications as read.

---

## Module 18 — Promos

---

### POST `api.kanvise.com/schools/me/promos`
**Host:** Hono | **Auth:** `A`

Creates a promotional banner for the school's public page.

**Request body:**
```json
{
  "title": "string",
  "image_key": "string",
  "link_type": "programme | sub_programme | course",
  "link_id": "uuid",
  "order_index": 0
}
```

**Response 201:** Full promo object.

---

### GET `api.kanvise.com/schools/me/promos`
**Host:** Hono | **Auth:** `A`

Lists all promos for the school ordered by `order_index`.

---

### PATCH `api.kanvise.com/promos/:id`
**Host:** Hono | **Auth:** `A`

Updates a promo.

---

### DELETE `api.kanvise.com/promos/:id`
**Host:** Hono | **Auth:** `A`

Deletes a promo.

---

### PATCH `api.kanvise.com/schools/me/promos/reorder`
**Host:** Hono | **Auth:** `A`

Updates the display order of promos.

**Request body:**
```json
{
  "order": ["uuid", "uuid", "uuid"]
}
```

**Response 200:**
```json
{ "message": "Promos reordered" }
```

---

## Module 19 — Reviews

---

### POST `api.kanvise.com/reviews`
**Host:** Hono | **Auth:** `S`

Creates a review. Student must be enrolled in the thing being reviewed.

**Request body:**
```json
{
  "programme_id": "uuid | null",
  "sub_programme_id": "uuid | null",
  "course_id": "uuid | null",
  "rating": 5,
  "review_text": "string | null"
}
```

**Response 201:** Full review object.

**Errors:** `403 NOT_ENROLLED`, `409 ALREADY_REVIEWED`, `400 INVALID_REVIEW_TARGET`

---

### GET `api.kanvise.com/programmes/:id/reviews`
**Host:** Hono | **Auth:** PUBLIC

Returns published reviews for a programme.

**Query params:**
```
limit: integer   (default 10)
page: integer
```

**Response 200:** Array of review objects with average rating.

---

### GET `api.kanvise.com/sub-programmes/:id/reviews`
**Host:** Hono | **Auth:** PUBLIC

Returns published reviews for a sub-programme.

---

### GET `api.kanvise.com/courses/:id/reviews`
**Host:** Hono | **Auth:** PUBLIC

Returns published reviews for a course.

---

### PATCH `api.kanvise.com/reviews/:id/visibility`
**Host:** Hono | **Auth:** `A`

Admin toggles whether a review is published or hidden.

**Request body:**
```json
{ "is_published": false }
```

---

## Module 20 — Subscriptions & Billing

---

### POST `api.kanvise.com/subscriptions/initiate`
**Host:** Hono | **Auth:** `A`

Initiates a Kanvise platform subscription payment for the tutorial centre.

**Response 201:**
```json
{
  "data": {
    "payment_url": "https://checkout.paystack.com/xxxx",
    "amount": 9999.00,
    "paystack_reference": "string"
  }
}
```

---

### GET `api.kanvise.com/subscriptions/me`
**Host:** Hono | **Auth:** `A`

Returns the current school's subscription status.

**Response 200:**
```json
{
  "data": {
    "status": "active",
    "started_at": "timestamp",
    "expires_at": "timestamp",
    "days_remaining": 24
  }
}
```

---

### GET `api.kanvise.com/subscriptions/me/history`
**Host:** Hono | **Auth:** `A`

Returns billing history for the school.

---

## Appendix A — HTTP Status Code Reference

| Code | Meaning | When Used |
|---|---|---|
| 200 | OK | Successful GET, PATCH, DELETE |
| 201 | Created | Successful POST that creates a resource |
| 400 | Bad Request | Invalid input, failed validation |
| 401 | Unauthorised | Missing or invalid JWT |
| 403 | Forbidden | Valid JWT but insufficient permission |
| 404 | Not Found | Resource does not exist or is not in the user's school |
| 409 | Conflict | Duplicate resource, constraint violation |
| 500 | Server Error | Unexpected server error |

---

## Appendix B — Error Code Reference

| Code | Description |
|---|---|
| `SCHOOL_ALREADY_EXISTS` | Admin already has a school |
| `SLUG_TAKEN` | The requested slug is already in use |
| `NOT_IN_SCHOOL` | Requested user does not belong to the tenant school |
| `NOT_ENROLLED` | Student is not enrolled in the relevant course/programme |
| `ALREADY_ENROLLED` | Student is already enrolled |
| `NOT_ASSIGNED_TO_COURSE` | Tutor is not assigned to the course |
| `ALREADY_ASSIGNED` | Tutor is already assigned to this course |
| `NOT_A_TUTOR` | Target user does not have the tutor role |
| `DEADLINE_PASSED` | Assignment deadline has passed |
| `DEADLINE_IN_PAST` | Provided deadline is in the past |
| `ALREADY_SUBMITTED` | Student has already submitted this assignment or mock |
| `ATTEMPT_ALREADY_EXISTS` | Student already has an attempt for this mock |
| `MCQ_REQUIRES_OPTIONS` | MCQ question submitted without options |
| `MCQ_MUST_HAVE_ONE_CORRECT_OPTION` | No correct option or multiple correct options |
| `NO_QUESTIONS` | Mock published with no questions |
| `NO_COURSES_IN_PROGRAMME` | Programme published with no courses |
| `ALREADY_REVIEWED` | Student has already reviewed this item |
| `INVALID_REVIEW_TARGET` | No valid programme/sub-programme/course specified |
| `INVALID_ENROLMENT_TARGET` | No valid purchase target specified |
| `INVALID_PARENT` | Course has both programme_id and sub_programme_id set |
| `ACTIVE_ENROLMENTS_EXIST` | Cannot delete — active student enrolments exist |
| `CLASS_NOT_LIVE` | Attempted to join a class that is not currently live |
| `ALREADY_LIVE` | Attempted to start a class that is already live |
| `NOT_CLASS_TUTOR` | Tutor is not assigned to this live class |
| `FILE_TOO_LARGE` | Uploaded file exceeds the size limit |
| `INVALID_FILE_TYPE` | File type is not permitted |
| `CANNOT_REMOVE_SELF` | Admin attempted to remove themselves from the school |

---

*End of Document — Version 1.0*
