# Kanvise — Entity Relationship Diagram & Database Schema
**Version:** 1.0  
**Prepared by:** Architecture Team  
**Date:** June 2026  
**Status:** Approved — Source of Truth for All Data Modelling

---

## Purpose

This document defines every table in the Kanvise database, every column in each table, every relationship between tables, and every constraint and index that must exist. This is the source of truth for the data layer. No table, column, or relationship should exist in the database that is not defined here. Any schema change requires this document to be updated first and approved before the migration is written.

All tables live in a single Supabase PostgreSQL database. UUID is used for all primary keys. All timestamps are stored in UTC. The `school_id` column on every tenant-scoped table is the foundation of the multi-tenancy model — refer to Document 03 for the full rules around its enforcement.

---

## 1. Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    PLATFORM LAYER                                            │
│                                                                                              │
│  ┌──────────────────────┐         ┌──────────────────────────┐                              │
│  │      schools         │         │   kanvise_subscriptions  │                              │
│  │──────────────────────│◄────────│──────────────────────────│                              │
│  │ id (PK)              │    1:M  │ id (PK)                  │                              │
│  │ name                 │         │ school_id (FK)            │                              │
│  │ slug (unique)        │         │ amount                    │                              │
│  │ description          │         │ status                    │                              │
│  │ logo_url             │         │ expires_at                │                              │
│  │ banner_url           │         └──────────────────────────┘                              │
│  │ video_intro_url      │         ┌──────────────────────────┐                              │
│  │ contact_email        │◄────────│   paystack_subaccounts   │                              │
│  │ contact_phone        │    1:1  │──────────────────────────│                              │
│  │ social links...      │         │ id (PK)                  │                              │
│  │ is_active            │         │ school_id (FK, unique)   │                              │
│  │ paystack_subaccount  │         │ subaccount_code          │                              │
│  └──────────┬───────────┘         └──────────────────────────┘                              │
└─────────────┼───────────────────────────────────────────────────────────────────────────────┘
              │ 1:M (school has many users, programmes, etc.)
              │
┌─────────────▼───────────────────────────────────────────────────────────────────────────────┐
│                                     USER LAYER                                               │
│                                                                                              │
│  ┌──────────────────────┐         ┌──────────────────────────┐                              │
│  │    user_profiles     │────────►│     avatar_configs       │                              │
│  │──────────────────────│   1:1   │──────────────────────────│                              │
│  │ id (PK)              │         │ id (PK)                  │                              │
│  │ supabase_auth_id     │         │ user_id (FK, unique)     │                              │
│  │ school_id (FK)       │         │ school_id (FK)           │                              │
│  │ kanvise_user_id      │         │ skin_tone                │                              │
│  │ role (admin/tutor/   │         │ face_shape               │                              │
│  │       student)       │         │ hair_style               │                              │
│  │ first_name           │         │ hair_colour              │                              │
│  │ last_name            │         │ outfit_colour            │                              │
│  │ email                │         │ accessory                │                              │
│  └──────────────────────┘         │ headwear                 │                              │
│                                   └──────────────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   STRUCTURE LAYER                                            │
│                                                                                              │
│  ┌──────────────┐  1:M  ┌──────────────────┐  1:M  ┌──────────────────────────────┐        │
│  │  programmes  │──────►│  sub_programmes  │──────►│         courses              │        │
│  │──────────────│       │──────────────────│       │──────────────────────────────│        │
│  │ id (PK)      │       │ id (PK)          │       │ id (PK)                      │        │
│  │ school_id    │       │ school_id        │       │ school_id                    │        │
│  │ name         │       │ programme_id(FK) │       │ programme_id (FK, nullable)  │        │
│  │ slug         │       │ name             │       │ sub_programme_id(FK,nullable)│        │
│  │ description  │       │ slug             │       │ name                         │        │
│  │ price        │       │ description      │       │ slug                         │        │
│  │ is_published │  1:M  │ price            │       │ description                  │        │
│  └──────────────┘──────►│ is_published     │       │ price                        │        │
│         programmes      └──────────────────┘       │ is_published                 │        │
│         can also have                              └──────────────┬───────────────┘        │
│         courses directly                                          │                         │
│                                                                   │ 1:M                     │
│  ┌───────────────────────────────────────────────────────────────▼───────────────┐         │
│  │                          tutor_course_assignments                              │         │
│  │  id (PK) | school_id | tutor_id (FK→users) | course_id (FK) | assigned_at    │         │
│  └───────────────────────────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  ENROLMENT LAYER                                             │
│                                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────────┐               │
│  │                             enrolments                                   │               │
│  │──────────────────────────────────────────────────────────────────────────│               │
│  │ id (PK)                                                                  │               │
│  │ school_id (FK)                                                           │               │
│  │ student_id (FK → user_profiles)                                          │               │
│  │ programme_id (FK → programmes, nullable)      ─── exactly one of        │               │
│  │ sub_programme_id (FK → sub_programmes, nullable)   these three          │               │
│  │ course_id (FK → courses, nullable)            ─── must be set           │               │
│  │ payment_id (FK → payments)                                               │               │
│  │ enrolled_at                                                              │               │
│  └──────────────────────────────────────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CONTENT LAYER                                              │
│                                                                                              │
│  courses (1) ──────────────────────────────────────────────────── (M) all content below     │
│                                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────────┐             │
│  │    live_classes     │  │       notes         │  │      assignments        │             │
│  │─────────────────────│  │─────────────────────│  │─────────────────────────│             │
│  │ id (PK)             │  │ id (PK)             │  │ id (PK)                 │             │
│  │ school_id           │  │ school_id           │  │ school_id               │             │
│  │ course_id (FK)      │  │ course_id (FK)      │  │ course_id (FK)          │             │
│  │ tutor_id (FK)       │  │ tutor_id (FK)       │  │ tutor_id (FK)           │             │
│  │ title               │  │ title               │  │ title                   │             │
│  │ scheduled_at        │  │ description         │  │ description             │             │
│  │ duration_minutes    │  │ file_key            │  │ deadline_at             │             │
│  │ status              │  │ file_name           │  │ attachment_file_key     │             │
│  │ livekit_room_name   │  │ file_type           │  │ is_published            │             │
│  │ started_at          │  │ file_size_bytes     │  └─────────┬───────────────┘             │
│  │ ended_at            │  └─────────────────────┘            │ 1:M                         │
│  │ notification_sent   │                                      ▼                             │
│  └────────┬────────────┘                         ┌─────────────────────────┐               │
│           │ 1:M                                   │      submissions        │               │
│           ▼                                       │─────────────────────────│               │
│  ┌─────────────────────┐                          │ id (PK)                 │               │
│  │ attendance_records  │                          │ school_id               │               │
│  │─────────────────────│                          │ assignment_id (FK)      │               │
│  │ id (PK)             │                          │ student_id (FK)         │               │
│  │ school_id           │                          │ file_key                │               │
│  │ live_class_id (FK)  │                          │ submitted_at            │               │
│  │ student_id (FK)     │                          │ score                   │               │
│  │ joined_at           │                          │ feedback                │               │
│  │ left_at             │                          │ reviewed_at             │               │
│  │ duration_seconds    │                          │ reviewed_by (FK)        │               │
│  └─────────────────────┘                          └─────────────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                  MOCK EXAM LAYER                                             │
│                                                                                              │
│  ┌──────────────┐  1:M  ┌──────────────────────┐  1:M  ┌────────────────────────────┐      │
│  │  mock_exams  │──────►│   mock_questions     │──────►│   mock_question_options    │      │
│  │──────────────│       │──────────────────────│       │────────────────────────────│      │
│  │ id (PK)      │       │ id (PK)              │       │ id (PK)                    │      │
│  │ school_id    │       │ school_id            │       │ school_id                  │      │
│  │ course_id    │       │ mock_exam_id (FK)    │       │ question_id (FK)           │      │
│  │ tutor_id     │       │ question_type        │       │ option_text                │      │
│  │ title        │       │ question_text        │       │ is_correct (bool)          │      │
│  │ status       │       │ marks                │       │ order_index                │      │
│  │ publish_at   │       │ order_index          │       └────────────────────────────┘      │
│  │ time_limit   │       └──────────────────────┘                                           │
│  └──────┬───────┘                                                                           │
│         │ 1:M                                                                               │
│         ▼                                                                                   │
│  ┌──────────────────────┐  1:M  ┌──────────────────────────────────────────────────┐       │
│  │   mock_attempts      │──────►│            mock_answers                          │       │
│  │──────────────────────│       │──────────────────────────────────────────────────│       │
│  │ id (PK)              │       │ id (PK)                                          │       │
│  │ school_id            │       │ school_id                                        │       │
│  │ mock_exam_id (FK)    │       │ attempt_id (FK → mock_attempts)                  │       │
│  │ student_id (FK)      │       │ question_id (FK → mock_questions)                │       │
│  │ started_at           │       │ selected_option_id (FK → options, nullable)      │       │
│  │ submitted_at         │       │ theory_answer_text (nullable)                    │       │
│  │ status               │       │ is_correct (nullable — set on MCQ submission)    │       │
│  │ mcq_score            │       │ tutor_score (nullable — set for theory)          │       │
│  │ total_mcq_questions  │       │ tutor_feedback (nullable)                        │       │
│  │ correct_mcq_answers  │       └──────────────────────────────────────────────────┘       │
│  └──────────────────────┘                                                                   │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              PAYMENT & PUBLIC PAGE LAYER                                     │
│                                                                                              │
│  ┌──────────────────────────────────┐   ┌────────────────────────┐                         │
│  │           payments               │   │     school_promos      │                         │
│  │──────────────────────────────────│   │────────────────────────│                         │
│  │ id (PK)                          │   │ id (PK)                │                         │
│  │ school_id (FK)                   │   │ school_id (FK)         │                         │
│  │ student_id (FK)                  │   │ title                  │                         │
│  │ programme_id (nullable)          │   │ image_key              │                         │
│  │ sub_programme_id (nullable)      │   │ link_type              │                         │
│  │ course_id (nullable)             │   │ link_id                │                         │
│  │ amount                           │   │ order_index            │                         │
│  │ kanvise_fee                      │   │ is_active              │                         │
│  │ centre_amount                    │   └────────────────────────┘                         │
│  │ currency                         │   ┌────────────────────────┐                         │
│  │ paystack_reference (unique)      │   │       reviews          │                         │
│  │ status                           │   │────────────────────────│                         │
│  │ paid_at                          │   │ id (PK)                │                         │
│  └──────────────────────────────────┘   │ school_id (FK)         │                         │
│                                         │ student_id (FK)        │                         │
│  ┌──────────────────────────────────┐   │ programme_id (nullable)│                         │
│  │         notifications            │   │ sub_programme_id (null)│                         │
│  │──────────────────────────────────│   │ course_id (nullable)   │                         │
│  │ id (PK)                          │   │ rating (1–5)           │                         │
│  │ school_id (FK)                   │   │ review_text (nullable) │                         │
│  │ user_id (FK)                     │   │ is_published           │                         │
│  │ type                             │   └────────────────────────┘                         │
│  │ title                            │                                                       │
│  │ body                             │                                                       │
│  │ is_read                          │                                                       │
│  │ related_entity_type              │                                                       │
│  │ related_entity_id                │                                                       │
│  └──────────────────────────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Table Definitions

### 2.1 schools

The primary tenant table. Every tutorial centre on Kanvise is a row in this table. All tenant-scoped tables reference this via `school_id`.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | Primary key |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Record creation time |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | Last update time |
| name | TEXT | NOT NULL | Tutorial centre display name |
| slug | TEXT | NOT NULL, UNIQUE | URL-safe identifier e.g. `brightminds` |
| description | TEXT | NULLABLE | School bio / about section |
| logo_url | TEXT | NULLABLE | Cloudflare R2 public URL for school logo |
| banner_url | TEXT | NULLABLE | Cloudflare R2 public URL for banner image |
| video_intro_url | TEXT | NULLABLE | Cloudflare R2 URL for optional video intro |
| contact_email | TEXT | NULLABLE | School contact email |
| contact_phone | TEXT | NULLABLE | School contact phone (WhatsApp-friendly) |
| website_url | TEXT | NULLABLE | External website URL |
| instagram_url | TEXT | NULLABLE | Instagram profile URL |
| twitter_url | TEXT | NULLABLE | Twitter/X profile URL |
| facebook_url | TEXT | NULLABLE | Facebook page URL |
| whatsapp_number | TEXT | NULLABLE | WhatsApp contact number |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Whether the school is active on Kanvise |
| paystack_subaccount_code | TEXT | NULLABLE | Paystack subaccount code for split payments |

**Indexes:** `slug` (UNIQUE), `is_active`

---

### 2.2 user_profiles

One row per Kanvise user. Linked to Supabase Auth via `supabase_auth_id`. Every user belongs to exactly one school.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | Kanvise internal user ID |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| supabase_auth_id | UUID | NOT NULL, UNIQUE | Links to Supabase Auth `auth.users.id` |
| school_id | UUID | NOT NULL, FK → schools.id | The school this user belongs to |
| kanvise_user_id | TEXT | NOT NULL, UNIQUE | Human-readable ID e.g. `KNV-ADM-00001` |
| role | TEXT | NOT NULL, CHECK IN ('admin','tutor','student') | User role |
| first_name | TEXT | NOT NULL | |
| last_name | TEXT | NOT NULL | |
| email | TEXT | NOT NULL | Mirrors Supabase Auth email |
| bio | TEXT | NULLABLE | Tutor bio — displayed on public tutor card |
| profile_photo_key | TEXT | NULLABLE | R2 key for tutor profile photo |

**Indexes:** `supabase_auth_id` (UNIQUE), `school_id`, `kanvise_user_id` (UNIQUE), `(school_id, role)`

---

### 2.3 avatar_configs

Stores the customisation choices for each user's cartoon avatar. One row per user.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| user_id | UUID | NOT NULL, UNIQUE, FK → user_profiles.id | One avatar per user |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| skin_tone | TEXT | NOT NULL | Skin tone selection key |
| face_shape | TEXT | NOT NULL | Face shape selection key |
| hair_style | TEXT | NOT NULL | Hair style selection key |
| hair_colour | TEXT | NOT NULL | Hair colour selection key |
| outfit_colour | TEXT | NOT NULL | Outfit colour selection key |
| accessory | TEXT | NULLABLE | Glasses or other accessory key |
| headwear | TEXT | NULLABLE | Hat or headwear key |

**Indexes:** `user_id` (UNIQUE), `school_id`

---

### 2.4 kanvise_subscriptions

Records of tutorial centre monthly subscription payments to Kanvise.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Which tutorial centre |
| paystack_reference | TEXT | NOT NULL, UNIQUE | Paystack transaction reference |
| amount | NUMERIC(12,2) | NOT NULL | Amount paid in NGN |
| currency | TEXT | NOT NULL, DEFAULT 'NGN' | |
| status | TEXT | NOT NULL, CHECK IN ('pending','active','expired','failed') | |
| started_at | TIMESTAMPTZ | NULLABLE | When subscription period begins |
| expires_at | TIMESTAMPTZ | NULLABLE | When subscription period ends |
| paid_at | TIMESTAMPTZ | NULLABLE | When payment was confirmed |

**Indexes:** `school_id`, `paystack_reference` (UNIQUE), `status`, `expires_at`

---

### 2.5 paystack_subaccounts

Stores the Paystack subaccount created for each tutorial centre. Used for split payments when students pay.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, UNIQUE, FK → schools.id | One subaccount per school |
| subaccount_code | TEXT | NOT NULL, UNIQUE | Paystack subaccount code e.g. `ACCT_xxxx` |
| business_name | TEXT | NOT NULL | Name as registered with Paystack |
| bank_code | TEXT | NOT NULL | Bank code |
| account_number | TEXT | NOT NULL | Bank account number |
| percentage_charge | NUMERIC(5,2) | NOT NULL | Percentage Kanvise takes per transaction |

**Indexes:** `school_id` (UNIQUE), `subaccount_code` (UNIQUE)

---

### 2.6 programmes

A programme is the top-level purchasable enrolment unit offered by a tutorial centre.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| name | TEXT | NOT NULL | e.g. `WAEC Bootcamp 2026` |
| slug | TEXT | NOT NULL | URL-safe identifier |
| description | TEXT | NULLABLE | Marketing description |
| price | NUMERIC(12,2) | NOT NULL | Price in NGN |
| currency | TEXT | NOT NULL, DEFAULT 'NGN' | |
| thumbnail_url | TEXT | NULLABLE | R2 URL for programme thumbnail image |
| is_published | BOOLEAN | NOT NULL, DEFAULT false | Whether visible on public page |
| created_by | UUID | NOT NULL, FK → user_profiles.id | Admin who created it |

**Indexes:** `school_id`, `(school_id, slug)` (UNIQUE within school), `is_published`

---

### 2.7 sub_programmes

An optional layer between a programme and its courses. Used when a programme has distinct tracks e.g. JAMB-Science vs JAMB-Art.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| programme_id | UUID | NOT NULL, FK → programmes.id | Parent programme |
| name | TEXT | NOT NULL | e.g. `JAMB Science Track` |
| slug | TEXT | NOT NULL | URL-safe identifier |
| description | TEXT | NULLABLE | |
| price | NUMERIC(12,2) | NOT NULL | Separate-purchase price; `0` when included only |
| is_available_separately | BOOLEAN | NOT NULL, DEFAULT false | Whether students may buy this without buying the parent programme |
| currency | TEXT | NOT NULL, DEFAULT 'NGN' | |
| is_published | BOOLEAN | NOT NULL, DEFAULT false | |
| created_by | UUID | NOT NULL, FK → user_profiles.id | |

**Indexes:** `school_id`, `programme_id`, `(school_id, programme_id, slug)` (UNIQUE)

---

### 2.8 courses

The atomic content unit. Can exist standalone (no programme), directly under a programme, or under a sub-programme. `programme_id` and `sub_programme_id` are both nullable — at most one can be set; if neither is set the course is standalone.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| programme_id | UUID | NULLABLE, FK → programmes.id | Set if course sits directly under a programme |
| sub_programme_id | UUID | NULLABLE, FK → sub_programmes.id | Set if course sits under a sub-programme |
| name | TEXT | NOT NULL | e.g. `Chemistry`, `English Language` |
| slug | TEXT | NOT NULL | URL-safe identifier |
| description | TEXT | NULLABLE | |
| price | NUMERIC(12,2) | NOT NULL | Separate-purchase price; `0` when included only |
| is_available_separately | BOOLEAN | NOT NULL, DEFAULT false | Whether students may buy this course without buying its parent |
| currency | TEXT | NOT NULL, DEFAULT 'NGN' | |
| is_published | BOOLEAN | NOT NULL, DEFAULT false | |
| created_by | UUID | NOT NULL, FK → user_profiles.id | |

**Constraints:** CHECK that `programme_id` and `sub_programme_id` are not both set simultaneously (enforced at application layer in Hono).

**Indexes:** `school_id`, `programme_id`, `sub_programme_id`, `(school_id, slug)` (UNIQUE within school), `is_published`

---

### 2.9 tutor_course_assignments

Junction table linking tutors to the courses they teach. A tutor can teach multiple courses; a course can have multiple tutors.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| tutor_id | UUID | NOT NULL, FK → user_profiles.id | Must have role = 'tutor' |
| course_id | UUID | NOT NULL, FK → courses.id | The course being assigned |
| assigned_by | UUID | NOT NULL, FK → user_profiles.id | Admin who made the assignment |
| assigned_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |

**Indexes:** `school_id`, `tutor_id`, `course_id`, `(tutor_id, course_id)` (UNIQUE — a tutor is assigned once per course)

---

### 2.10 enrolments

Records a student's access to a programme, sub-programme, or course. Exactly one of `programme_id`, `sub_programme_id`, or `course_id` must be non-null per row. Created after successful payment confirmation.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| student_id | UUID | NOT NULL, FK → user_profiles.id | The enrolled student |
| programme_id | UUID | NULLABLE, FK → programmes.id | Set if enrolled in a programme |
| sub_programme_id | UUID | NULLABLE, FK → sub_programmes.id | Set if enrolled in a sub-programme |
| course_id | UUID | NULLABLE, FK → courses.id | Set if enrolled in a standalone course |
| payment_id | UUID | NOT NULL, FK → payments.id | The payment that triggered this enrolment |
| enrolled_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | When access was granted |

**Indexes:** `school_id`, `student_id`, `programme_id`, `sub_programme_id`, `course_id`, `(student_id, programme_id)`, `(student_id, course_id)`

---

### 2.11 live_classes

A scheduled live video session hosted by a tutor for a course.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| course_id | UUID | NOT NULL, FK → courses.id | The course this class belongs to |
| tutor_id | UUID | NOT NULL, FK → user_profiles.id | The hosting tutor |
| title | TEXT | NOT NULL | e.g. `Organic Chemistry — Week 3` |
| scheduled_at | TIMESTAMPTZ | NOT NULL | When the class is scheduled to start |
| duration_minutes | INTEGER | NOT NULL | Expected duration |
| status | TEXT | NOT NULL, DEFAULT 'scheduled', CHECK IN ('scheduled','live','completed','cancelled') | |
| livekit_room_name | TEXT | NULLABLE | Set when class starts — the LiveKit room identifier |
| started_at | TIMESTAMPTZ | NULLABLE | Actual start time |
| ended_at | TIMESTAMPTZ | NULLABLE | Actual end time |
| notification_sent | BOOLEAN | NOT NULL, DEFAULT false | Whether the pre-class reminder was sent |
| created_by | UUID | NOT NULL, FK → user_profiles.id | Admin or tutor who scheduled it |

**Indexes:** `school_id`, `course_id`, `tutor_id`, `status`, `scheduled_at`, `(school_id, status, scheduled_at)` (compound — used by background job queries)

---

### 2.12 attendance_records

One row per student per live class join event. A student who joins, leaves, and rejoins will have multiple rows — duration is summed to get total attendance time.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| live_class_id | UUID | NOT NULL, FK → live_classes.id | The class attended |
| student_id | UUID | NOT NULL, FK → user_profiles.id | The attending student |
| joined_at | TIMESTAMPTZ | NOT NULL | Timestamp from LiveKit webhook |
| left_at | TIMESTAMPTZ | NULLABLE | Timestamp from LiveKit webhook — null if still in session |
| duration_seconds | INTEGER | NULLABLE | Calculated on `left_at` arrival: `left_at - joined_at` in seconds |

**Indexes:** `school_id`, `live_class_id`, `student_id`, `(live_class_id, student_id)`

---

### 2.13 notes

Class notes uploaded by tutors, linked to a course.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| course_id | UUID | NOT NULL, FK → courses.id | The course this note belongs to |
| tutor_id | UUID | NOT NULL, FK → user_profiles.id | The uploading tutor |
| title | TEXT | NOT NULL | Display name for the note |
| description | TEXT | NULLABLE | Optional description or context |
| file_key | TEXT | NOT NULL | R2 storage key e.g. `schools/{id}/notes/{uuid}.pdf` |
| file_name | TEXT | NOT NULL | Original filename as uploaded |
| file_type | TEXT | NOT NULL, CHECK IN ('pdf','docx','pptx','jpg','png') | |
| file_size_bytes | INTEGER | NOT NULL | File size in bytes |

**Indexes:** `school_id`, `course_id`, `tutor_id`

---

### 2.14 assignments

Assignments created by tutors for students in a course.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| course_id | UUID | NOT NULL, FK → courses.id | |
| tutor_id | UUID | NOT NULL, FK → user_profiles.id | |
| title | TEXT | NOT NULL | |
| description | TEXT | NOT NULL | Assignment instructions |
| deadline_at | TIMESTAMPTZ | NOT NULL | Submission deadline |
| attachment_file_key | TEXT | NULLABLE | R2 key for optional tutor-attached file |
| attachment_file_name | TEXT | NULLABLE | Original filename |
| is_published | BOOLEAN | NOT NULL, DEFAULT false | Whether visible to students |

**Indexes:** `school_id`, `course_id`, `tutor_id`, `deadline_at`, `is_published`

---

### 2.15 submissions

Student submissions for an assignment. One row per student per assignment.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| assignment_id | UUID | NOT NULL, FK → assignments.id | |
| student_id | UUID | NOT NULL, FK → user_profiles.id | |
| file_key | TEXT | NOT NULL | R2 key for the submitted file |
| file_name | TEXT | NOT NULL | Original filename |
| submitted_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| score | NUMERIC(5,2) | NULLABLE | Score assigned by tutor |
| feedback | TEXT | NULLABLE | Tutor written comment |
| reviewed_at | TIMESTAMPTZ | NULLABLE | When tutor reviewed it |
| reviewed_by | UUID | NULLABLE, FK → user_profiles.id | The reviewing tutor |

**Indexes:** `school_id`, `assignment_id`, `student_id`, `(assignment_id, student_id)` (UNIQUE — one submission per student per assignment)

---

### 2.16 mock_exams

A mock exam created by a tutor, linked to a course.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| course_id | UUID | NOT NULL, FK → courses.id | |
| tutor_id | UUID | NOT NULL, FK → user_profiles.id | |
| title | TEXT | NOT NULL | |
| description | TEXT | NULLABLE | |
| status | TEXT | NOT NULL, DEFAULT 'draft', CHECK IN ('draft','published','archived') | |
| publish_at | TIMESTAMPTZ | NULLABLE | If set, background job publishes at this time |
| time_limit_minutes | INTEGER | NULLABLE | NULL means no time limit |
| total_mcq_questions | INTEGER | NOT NULL, DEFAULT 0 | Computed and updated as questions are added |
| total_theory_questions | INTEGER | NOT NULL, DEFAULT 0 | |

**Indexes:** `school_id`, `course_id`, `tutor_id`, `status`, `(school_id, status, publish_at)` (compound — used by auto-publish background job)

---

### 2.17 mock_questions

Individual questions inside a mock exam. Supports both MCQ and theory types.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| mock_exam_id | UUID | NOT NULL, FK → mock_exams.id | |
| question_type | TEXT | NOT NULL, CHECK IN ('mcq','theory') | |
| question_text | TEXT | NOT NULL | The question body |
| marks | NUMERIC(5,2) | NOT NULL, DEFAULT 1 | Marks allocated to this question |
| order_index | INTEGER | NOT NULL | Controls display order |

**Indexes:** `school_id`, `mock_exam_id`, `(mock_exam_id, order_index)`

---

### 2.18 mock_question_options

Answer options for MCQ questions. The `is_correct` flag marks the correct option. Never returned to the client before submission.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| question_id | UUID | NOT NULL, FK → mock_questions.id | The parent MCQ question |
| option_text | TEXT | NOT NULL | The answer option text |
| is_correct | BOOLEAN | NOT NULL, DEFAULT false | Marks the correct answer |
| order_index | INTEGER | NOT NULL | Controls display order |

**Indexes:** `school_id`, `question_id`, `(question_id, order_index)`

---

### 2.19 mock_attempts

One row per student per mock exam attempt. Created when a student opens a published mock.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| mock_exam_id | UUID | NOT NULL, FK → mock_exams.id | |
| student_id | UUID | NOT NULL, FK → user_profiles.id | |
| started_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| submitted_at | TIMESTAMPTZ | NULLABLE | NULL until submitted |
| status | TEXT | NOT NULL, DEFAULT 'in_progress', CHECK IN ('in_progress','submitted','timed_out') | |
| mcq_score | NUMERIC(8,2) | NULLABLE | Total MCQ score computed on submission |
| total_mcq_questions | INTEGER | NULLABLE | Count of MCQ questions at time of submission |
| correct_mcq_answers | INTEGER | NULLABLE | Count of correct MCQ answers |

**Indexes:** `school_id`, `mock_exam_id`, `student_id`, `(mock_exam_id, student_id)` (UNIQUE — one attempt per student per mock at MVP)

---

### 2.20 mock_answers

Individual question answers submitted by a student during a mock attempt.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| attempt_id | UUID | NOT NULL, FK → mock_attempts.id | |
| question_id | UUID | NOT NULL, FK → mock_questions.id | |
| selected_option_id | UUID | NULLABLE, FK → mock_question_options.id | Set for MCQ answers |
| theory_answer_text | TEXT | NULLABLE | Set for theory answers |
| is_correct | BOOLEAN | NULLABLE | Set on submission for MCQ — null for theory |
| tutor_score | NUMERIC(5,2) | NULLABLE | Set by tutor when reviewing theory |
| tutor_feedback | TEXT | NULLABLE | Tutor comment on theory answer |

**Indexes:** `school_id`, `attempt_id`, `question_id`, `(attempt_id, question_id)` (UNIQUE — one answer per question per attempt)

---

### 2.21 payments

Records every student payment transaction. Created when payment is initiated, updated when webhook confirms or fails.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| student_id | UUID | NOT NULL, FK → user_profiles.id | |
| programme_id | UUID | NULLABLE, FK → programmes.id | What was purchased |
| sub_programme_id | UUID | NULLABLE, FK → sub_programmes.id | What was purchased |
| course_id | UUID | NULLABLE, FK → courses.id | What was purchased |
| amount | NUMERIC(12,2) | NOT NULL | Total amount paid by student (NGN) |
| kanvise_fee | NUMERIC(12,2) | NOT NULL | Kanvise's cut from this transaction |
| centre_amount | NUMERIC(12,2) | NOT NULL | Amount going to tutorial centre |
| currency | TEXT | NOT NULL, DEFAULT 'NGN' | |
| paystack_reference | TEXT | NOT NULL, UNIQUE | Paystack transaction reference |
| paystack_transaction_id | TEXT | NULLABLE | Paystack internal transaction ID |
| status | TEXT | NOT NULL, DEFAULT 'pending', CHECK IN ('pending','successful','failed') | |
| paid_at | TIMESTAMPTZ | NULLABLE | Set when webhook confirms success |

**Indexes:** `school_id`, `student_id`, `paystack_reference` (UNIQUE), `status`, `paid_at`

---

### 2.22 notifications

In-app notifications sent to users for platform events.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| user_id | UUID | NOT NULL, FK → user_profiles.id | Recipient |
| type | TEXT | NOT NULL, CHECK IN ('live_class_reminder','assignment_deadline','mock_published','payment_confirmed','enrolment_confirmed') | |
| title | TEXT | NOT NULL | Short notification heading |
| body | TEXT | NOT NULL | Notification body text |
| is_read | BOOLEAN | NOT NULL, DEFAULT false | |
| related_entity_type | TEXT | NULLABLE | e.g. `live_class`, `assignment`, `mock_exam` |
| related_entity_id | UUID | NULLABLE | ID of the related entity |

**Indexes:** `school_id`, `user_id`, `is_read`, `(user_id, is_read)` (compound — for fetching unread notifications)

---

### 2.23 school_promos

Promotional banners displayed on a school's public page. Each promo links to a programme, sub-programme, or course.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| title | TEXT | NOT NULL | Promo display title |
| image_key | TEXT | NOT NULL | R2 key for the promo image |
| link_type | TEXT | NOT NULL, CHECK IN ('programme','sub_programme','course') | What the promo links to |
| link_id | UUID | NOT NULL | ID of the linked programme, sub-programme, or course |
| order_index | INTEGER | NOT NULL, DEFAULT 0 | Controls display order on public page |
| is_active | BOOLEAN | NOT NULL, DEFAULT true | Whether shown on public page |

**Indexes:** `school_id`, `(school_id, is_active, order_index)`

---

### 2.24 reviews

Student reviews for a specific programme, sub-programme, or course. Displayed on the relevant public page.

| Column | Type | Constraints | Description |
|---|---|---|---|
| id | UUID | PK, DEFAULT gen_random_uuid() | |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT now() | |
| school_id | UUID | NOT NULL, FK → schools.id | Tenant scope |
| student_id | UUID | NOT NULL, FK → user_profiles.id | Reviewer — must be enrolled |
| programme_id | UUID | NULLABLE, FK → programmes.id | What is being reviewed |
| sub_programme_id | UUID | NULLABLE, FK → sub_programmes.id | What is being reviewed |
| course_id | UUID | NULLABLE, FK → courses.id | What is being reviewed |
| rating | INTEGER | NOT NULL, CHECK rating BETWEEN 1 AND 5 | Star rating |
| review_text | TEXT | NULLABLE | Optional written review |
| is_published | BOOLEAN | NOT NULL, DEFAULT true | Admin can hide a review |

**Indexes:** `school_id`, `student_id`, `programme_id`, `sub_programme_id`, `course_id`

---

## 3. Relationship Summary

| Relationship | Type | Notes |
|---|---|---|
| schools → user_profiles | 1:M | Every user belongs to one school |
| schools → programmes | 1:M | A school has many programmes |
| schools → courses | 1:M | A school has many courses (including standalone) |
| schools → kanvise_subscriptions | 1:M | A school has billing history |
| schools → paystack_subaccounts | 1:1 | One subaccount per school |
| programmes → sub_programmes | 1:M | A programme has optional sub-programmes |
| programmes → courses | 1:M | A programme can have courses directly |
| sub_programmes → courses | 1:M | A sub-programme has courses |
| user_profiles → avatar_configs | 1:1 | One avatar per user |
| courses → tutor_course_assignments | 1:M | A course has multiple tutors |
| user_profiles → tutor_course_assignments | 1:M | A tutor teaches multiple courses |
| courses → live_classes | 1:M | A course has many scheduled classes |
| courses → notes | 1:M | A course has many notes |
| courses → assignments | 1:M | A course has many assignments |
| courses → mock_exams | 1:M | A course has many mocks |
| live_classes → attendance_records | 1:M | A class has many attendance entries |
| assignments → submissions | 1:M | An assignment has many submissions |
| mock_exams → mock_questions | 1:M | A mock has many questions |
| mock_questions → mock_question_options | 1:M | An MCQ question has 2–6 options |
| mock_exams → mock_attempts | 1:M | A mock has many student attempts |
| mock_attempts → mock_answers | 1:M | An attempt has one answer per question |
| enrolments → payments | M:1 | Each enrolment is linked to one payment |
| students → enrolments | 1:M | A student has multiple enrolments |
| students → payments | 1:M | A student has multiple payments |

---

## 4. Enrolment Access Resolution

The access check for any content (notes, live class, assignment, mock) given a `student_id` and `course_id`:

```
Student has access to course if ANY of:

1. Direct course enrolment exists:
   enrolments WHERE student_id = X AND course_id = Y

2. Sub-programme enrolment, and course belongs to that sub-programme:
   enrolments WHERE student_id = X AND sub_programme_id = (
     courses.sub_programme_id WHERE courses.id = Y
   )

3. Programme enrolment, and course belongs (directly or via sub-programme) to that programme:
   enrolments WHERE student_id = X AND programme_id IN (
     courses.programme_id WHERE courses.id = Y
     UNION
     sub_programmes.programme_id WHERE sub_programmes.id = (
       courses.sub_programme_id WHERE courses.id = Y
     )
   )
```

This logic runs in Hono on every content access request for students. It is not a single SQL query — Hono resolves it in the application layer using the course's parent references.

---

## 5. Key Database Constraints

The following constraints are enforced at the application layer in Hono (not as database constraints, as some require cross-table validation):

**Enrolment uniqueness:** A student cannot be enrolled in the same programme, sub-programme, or course more than once. Checked before creating a new enrolment.

**Enrolment exclusivity:** Exactly one of `programme_id`, `sub_programme_id`, `course_id` must be set on an enrolment row. The other two must be null.

**Course parent exclusivity:** A course cannot have both `programme_id` and `sub_programme_id` set simultaneously. A standalone course has both as null.

**Review eligibility:** A student may only leave a review for a programme, sub-programme, or course they are enrolled in. Checked before creating a review.

**Tutor assignment validity:** Only users with `role = 'tutor'` can be added to `tutor_course_assignments`. Checked before inserting.

**Mock answer exclusivity:** For a given answer, either `selected_option_id` (MCQ) or `theory_answer_text` (theory) is set — not both. Determined by the question type of the referenced `question_id`.

---

## 6. Auto-Publish Background Job Query

The background job that runs every minute queries:

```sql
SELECT id, course_id, title
FROM mock_exams
WHERE status = 'draft'
  AND publish_at <= NOW()
  AND publish_at IS NOT NULL
ORDER BY publish_at ASC
LIMIT 100;
```

After updating each mock to `published`, the job fetches enrolled students for the relevant course and dispatches notification emails via Resend.

---

*End of Document — Version 1.0*
