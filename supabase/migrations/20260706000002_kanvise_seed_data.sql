-- Kanvise Staging & Development Seed Data
-- Canonical Architecture Mapping (Document 03, 04 & 06)
-- Migration: 20260706000002_kanvise_seed_data.sql

-- ============================================================================
-- 1. SEED TENANT: Acada Premier Center
-- ============================================================================

INSERT INTO schools (
    id, name, slug, description, address, 
    logo_url, banner_url, video_intro_url, contact_email, 
    contact_phone, website_url, is_active, paystack_subaccount_code
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    'Acada Premier Center',
    'acada-premier',
    'Nigeria''s leading tutorial center preparing students for WAEC, NECO, JAMB UTME, and Post-UTME excellence with interactive live classes and CBT practice.',
    '12 Allen Avenue, Ikeja, Lagos State, Nigeria',
    'https://images.unsplash.com/photo-1546410531-bb4caa6b424d?auto=format&fit=crop&w=300&q=80',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'info@acadapremier.ng',
    '+2348012345678',
    'https://acadapremier.ng',
    true,
    'ACCT_acada12345'
) ON CONFLICT (id) DO NOTHING;

-- Seed Paystack Subaccount
INSERT INTO paystack_subaccounts (
    id, school_id, subaccount_code, business_name, bank_code, account_number, percentage_charge
) VALUES (
    '77777777-7777-7777-7777-777777777701',
    '11111111-1111-1111-1111-111111111111',
    'ACCT_acada12345',
    'Acada Premier Educational Services',
    '058',
    '0123456789',
    5.00
) ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. SEED USERS: 1 Admin, 2 Tutors, 3 Students
-- ============================================================================

INSERT INTO user_profiles (
    id, supabase_auth_id, school_id, role, kanvise_user_id, 
    first_name, last_name, email, profile_photo_url, is_active
) VALUES 
-- Admin
(
    '33333333-3333-3333-3333-333333333301',
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111111',
    'admin',
    'ACA-ADM-00001',
    'Dr. Samuel',
    'Okon',
    'admin@acadapremier.ng',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80',
    true
),
-- Tutor 1
(
    '33333333-3333-3333-3333-333333333302',
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111111',
    'tutor',
    'ACA-TUT-00001',
    'Prof. Chinedu',
    'Eze',
    'chinedu.eze@acadapremier.ng',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    true
),
-- Tutor 2
(
    '33333333-3333-3333-3333-333333333303',
    '22222222-2222-2222-2222-222222222203',
    '11111111-1111-1111-1111-111111111111',
    'tutor',
    'ACA-TUT-00002',
    'Mrs. Amina',
    'Bello',
    'amina.bello@acadapremier.ng',
    'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80',
    true
),
-- Student 1
(
    '33333333-3333-3333-3333-333333333304',
    '22222222-2222-2222-2222-222222222204',
    '11111111-1111-1111-1111-111111111111',
    'student',
    'ACA-STU-00001',
    'Tobi',
    'Bakre',
    'tobi.bakre@student.ng',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    true
),
-- Student 2
(
    '33333333-3333-3333-3333-333333333305',
    '22222222-2222-2222-2222-222222222205',
    '11111111-1111-1111-1111-111111111111',
    'student',
    'ACA-STU-00002',
    'Zainab',
    'Usman',
    'zainab.usman@student.ng',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80',
    true
),
-- Student 3
(
    '33333333-3333-3333-3333-333333333306',
    '22222222-2222-2222-2222-222222222206',
    '11111111-1111-1111-1111-111111111111',
    'student',
    'ACA-STU-00003',
    'Emeka',
    'Okafor',
    'emeka.okafor@student.ng',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=200&q=80',
    true
) ON CONFLICT (id) DO NOTHING;

-- Update ID sequence counts
UPDATE kanvise_id_sequences SET current_val = 1 WHERE role_prefix = 'ACA-ADM';
UPDATE kanvise_id_sequences SET current_val = 2 WHERE role_prefix = 'ACA-TUT';
UPDATE kanvise_id_sequences SET current_val = 3 WHERE role_prefix = 'ACA-STU';

-- Seed Avatars for Students
INSERT INTO avatar_configs (
    user_id, school_id, skin_tone, face_shape, hair_style, hair_colour, outfit_colour, accessory, headwear
) VALUES 
('33333333-3333-3333-3333-333333333304', '11111111-1111-1111-1111-111111111111', 'dark', 'round', 'fade', 'black', 'blue', 'glasses', 'none'),
('33333333-3333-3333-3333-333333333305', '11111111-1111-1111-1111-111111111111', 'brown', 'oval', 'braids', 'black', 'purple', 'none', 'hijab'),
('33333333-3333-3333-3333-333333333306', '11111111-1111-1111-1111-111111111111', 'medium', 'square', 'short', 'black', 'green', 'none', 'cap')
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 3. SEED CURRICULUM: Programmes, Sub-programmes & Courses
-- ============================================================================

-- Programmes
INSERT INTO programmes (
    id, school_id, name, slug, description, price, currency, thumbnail_url, is_published, created_by
) VALUES 
(
    '44444444-4444-4444-4444-444444444401',
    '11111111-1111-1111-1111-111111111111',
    'WAEC & NECO Intensive Bootcamp 2026',
    'waec-neco-bootcamp-2026',
    'Complete masterclass covering all core science and arts subjects with daily live tutoring, past question analysis, and CBT mock drills.',
    50000.00,
    'NGN',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=600&q=80',
    true,
    '33333333-3333-3333-3333-333333333301'
),
(
    '44444444-4444-4444-4444-444444444402',
    '11111111-1111-1111-1111-111111111111',
    'JAMB UTME Fast-Track 2026',
    'jamb-utme-fasttrack-2026',
    'Target 300+ in JAMB UTME with our intensive speed-drills, CBT time-management techniques, and specialized track coaching.',
    35000.00,
    'NGN',
    'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    true,
    '33333333-3333-3333-3333-333333333301'
) ON CONFLICT (id) DO NOTHING;

-- Sub-programmes
INSERT INTO sub_programmes (
    id, school_id, programme_id, name, slug, description, price, currency, is_published, created_by
) VALUES 
(
    '55555555-5555-5555-5555-555555555501',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444402',
    'JAMB Science & Engineering Track',
    'jamb-science-track',
    'Focused preparation for Physics, Chemistry, Biology, and Mathematics aspirants.',
    25000.00,
    'NGN',
    true,
    '33333333-3333-3333-3333-333333333301'
),
(
    '55555555-5555-5555-5555-555555555502',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444402',
    'JAMB Arts & Humanities Track',
    'jamb-arts-track',
    'Focused preparation for Government, Literature in English, CRS/IRS, and Economics aspirants.',
    25000.00,
    'NGN',
    true,
    '33333333-3333-3333-3333-333333333301'
) ON CONFLICT (id) DO NOTHING;

-- Courses
INSERT INTO courses (
    id, school_id, programme_id, sub_programme_id, name, slug, description, price, currency, is_published, created_by
) VALUES 
-- Course 1: Under Sub-programme 1
(
    '66666666-6666-6666-6666-666666666601',
    '11111111-1111-1111-1111-111111111111',
    NULL,
    '55555555-5555-5555-5555-555555555501',
    'Organic & Inorganic Chemistry 101',
    'chemistry-101',
    'Deep dive into chemical bonding, stoichiometry, periodic trends, and organic reactions.',
    10000.00,
    'NGN',
    true,
    '33333333-3333-3333-3333-333333333301'
),
-- Course 2: Under Programme 1 directly
(
    '66666666-6666-6666-6666-666666666602',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444401',
    NULL,
    'Advanced Further Mathematics',
    'further-maths-advanced',
    'Master calculus, matrices, vectors, and coordinate geometry for WAEC Distinction.',
    15000.00,
    'NGN',
    true,
    '33333333-3333-3333-3333-333333333301'
),
-- Course 3: Standalone Course (Free Course Demo)
(
    '66666666-6666-6666-6666-666666666603',
    '11111111-1111-1111-1111-111111111111',
    NULL,
    NULL,
    'Use of English & Verbal Reasoning',
    'use-of-english-free',
    'Free foundation course covering lexis, structure, comprehension, and oral English techniques.',
    0.00,
    'NGN',
    true,
    '33333333-3333-3333-3333-333333333301'
) ON CONFLICT (id) DO NOTHING;

-- Tutor Assignments
INSERT INTO tutor_course_assignments (
    school_id, tutor_id, course_id, assigned_by
) VALUES 
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333302', '66666666-6666-6666-6666-666666666601', '33333333-3333-3333-3333-333333333301'),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333302', '66666666-6666-6666-6666-666666666602', '33333333-3333-3333-3333-333333333301'),
('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333303', '66666666-6666-6666-6666-666666666603', '33333333-3333-3333-3333-333333333301')
ON CONFLICT (tutor_id, course_id) DO NOTHING;

-- ============================================================================
-- 4. SEED MARKETING: Promos & Reviews
-- ============================================================================

INSERT INTO school_promos (
    id, school_id, title, image_key, link_type, link_id, order_index, is_active
) VALUES (
    '88888888-8888-8888-8888-888888888801',
    '11111111-1111-1111-1111-111111111111',
    'Early Bird Discount - 20% Off WAEC Bootcamp',
    'promos/waec-discount.png',
    'programme',
    '44444444-4444-4444-4444-444444444401',
    1,
    true
) ON CONFLICT (id) DO NOTHING;

INSERT INTO reviews (
    school_id, student_id, programme_id, rating, review_text, is_published
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333304',
    '44444444-4444-4444-4444-444444444401',
    5,
    'The WAEC Bootcamp changed my confidence completely! Prof. Chinedu explains chemistry like nobody else.',
    true
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- 5. SEED CBT ENGINE: Mock Exam, Questions & Options
-- ============================================================================

INSERT INTO mock_exams (
    id, school_id, course_id, tutor_id, title, description, status, publish_at, time_limit_minutes, total_mcq_questions, total_theory_questions
) VALUES (
    '99999999-9999-9999-9999-999999999901',
    '11111111-1111-1111-1111-111111111111',
    '66666666-6666-6666-6666-666666666601',
    '33333333-3333-3333-3333-333333333302',
    'JAMB UTME Chemistry Mock Test #1',
    'Practice mock test covering periodic table, atomic structure, and chemical bonding.',
    'published',
    now(),
    30,
    3,
    1
) ON CONFLICT (id) DO NOTHING;

-- MCQ Question 1
INSERT INTO mock_questions (id, school_id, mock_exam_id, question_type, question_text, marks, order_index) VALUES 
('aaaa0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999901', 'mcq', 'What is the oxidation number of Chromium in K2Cr2O7?', 2.00, 1),
('aaaa0000-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999901', 'mcq', 'Which of the following gases turns acidified potassium manganate(VII) solution colorless?', 2.00, 2),
('aaaa0000-0000-0000-0000-000000000003', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999901', 'mcq', 'Which of the following organic compounds is an isomer of ethanol?', 2.00, 3),
('aaaa0000-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', '99999999-9999-9999-9999-999999999901', 'theory', 'Explain the difference between ionic and covalent bonding with one clear chemical example for each.', 5.00, 4)
ON CONFLICT (id) DO NOTHING;

-- Options for Question 1
INSERT INTO mock_question_options (school_id, question_id, option_text, is_correct, order_index) VALUES 
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000001', '+4', false, 1),
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000001', '+6', true, 2),
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000001', '+7', false, 3),
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000001', '+2', false, 4);

-- Options for Question 2
INSERT INTO mock_question_options (school_id, question_id, option_text, is_correct, order_index) VALUES 
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000002', 'CO2', false, 1),
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000002', 'SO2', true, 2),
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000002', 'N2', false, 3),
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000002', 'O2', false, 4);

-- Options for Question 3
INSERT INTO mock_question_options (school_id, question_id, option_text, is_correct, order_index) VALUES 
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000003', 'Methoxymethane (Dimethyl ether)', true, 1),
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000003', 'Ethanal', false, 2),
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000003', 'Propan-1-ol', false, 3),
('11111111-1111-1111-1111-111111111111', 'aaaa0000-0000-0000-0000-000000000003', 'Ethanoic acid', false, 4);

-- ============================================================================
-- 6. SEED ENROLMENTS & PAYMENTS
-- ============================================================================

-- Student 1 (Tobi) enrolled in WAEC Bootcamp (Programme 1) via successful payment
INSERT INTO payments (
    id, school_id, student_id, programme_id, amount, kanvise_fee, centre_amount, currency, paystack_reference, status, paid_at
) VALUES (
    'bbbb0000-0000-0000-0000-000000000001',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333304',
    '44444444-4444-4444-4444-444444444401',
    50000.00,
    2500.00,
    47500.00,
    'NGN',
    'REF_ACADA_BOOTCAMP_001',
    'successful',
    now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO enrolments (
    school_id, student_id, programme_id, payment_id, enrolled_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333304',
    '44444444-4444-4444-4444-444444444401',
    'bbbb0000-0000-0000-0000-000000000001',
    now()
) ON CONFLICT DO NOTHING;

-- Student 2 (Zainab) enrolled in Free Course (Course 3) with 0 NGN payment record
INSERT INTO payments (
    id, school_id, student_id, course_id, amount, kanvise_fee, centre_amount, currency, paystack_reference, status, paid_at
) VALUES (
    'bbbb0000-0000-0000-0000-000000000002',
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333305',
    '66666666-6666-6666-6666-666666666603',
    0.00,
    0.00,
    0.00,
    'NGN',
    'FREE_ENROL_ZAINAB_001',
    'successful',
    now()
) ON CONFLICT (id) DO NOTHING;

INSERT INTO enrolments (
    school_id, student_id, course_id, payment_id, enrolled_at
) VALUES (
    '11111111-1111-1111-1111-111111111111',
    '33333333-3333-3333-3333-333333333305',
    '66666666-6666-6666-6666-666666666603',
    'bbbb0000-0000-0000-0000-000000000002',
    now()
) ON CONFLICT DO NOTHING;
