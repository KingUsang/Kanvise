-- Telegram is a delivery and check-in layer. Teaching content remains native to
-- Telegram and Kanvise remains the source of truth for payments and learning.

CREATE TABLE public.telegram_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL UNIQUE,
  chat_type TEXT NOT NULL CHECK (chat_type IN ('group', 'supergroup', 'channel')),
  purpose TEXT NOT NULL DEFAULT 'teaching' CHECK (purpose IN ('teaching', 'paid_teaching')),
  title TEXT,
  username TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  connected_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_telegram_chats_school_active
  ON public.telegram_chats(school_id, status);

CREATE UNIQUE INDEX uq_telegram_paid_teaching_chat_per_school
  ON public.telegram_chats(school_id)
  WHERE purpose = 'paid_teaching' AND status = 'active';

CREATE TABLE public.telegram_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  private_chat_id BIGINT NOT NULL,
  username TEXT,
  first_name TEXT,
  reminders_enabled BOOLEAN NOT NULL DEFAULT true,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, user_id),
  UNIQUE (school_id, telegram_user_id)
);

CREATE INDEX idx_telegram_identities_school_reminders
  ON public.telegram_identities(school_id, reminders_enabled)
  WHERE reminders_enabled;

CREATE TABLE public.telegram_connection_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('group', 'paid_group', 'reminders')),
  code_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  consumed_by_telegram_user_id BIGINT,
  consumed_chat_id BIGINT
);

CREATE INDEX idx_telegram_connection_codes_active
  ON public.telegram_connection_codes(code_hash, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE public.telegram_link_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  telegram_user_id BIGINT,
  private_chat_id BIGINT,
  telegram_username TEXT,
  telegram_first_name TEXT,
  confirmation_code_hash TEXT,
  confirmation_expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_telegram_link_challenges_active
  ON public.telegram_link_challenges(token_hash, expires_at)
  WHERE completed_at IS NULL;

CREATE TABLE public.telegram_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  idempotency_key TEXT NOT NULL UNIQUE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  telegram_identity_id UUID REFERENCES public.telegram_identities(id) ON DELETE SET NULL,
  telegram_chat_id BIGINT NOT NULL,
  event_type TEXT NOT NULL,
  message_text TEXT NOT NULL,
  action_text TEXT,
  action_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  telegram_message_id BIGINT,
  last_error TEXT,
  sent_at TIMESTAMPTZ
);

CREATE INDEX idx_telegram_deliveries_retry
  ON public.telegram_deliveries(status, updated_at)
  WHERE status IN ('pending', 'failed');

CREATE TABLE public.telegram_attendance_windows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  live_class_id UUID NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  telegram_chat_id BIGINT NOT NULL REFERENCES public.telegram_chats(telegram_chat_id) ON DELETE CASCADE,
  opened_by UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  closes_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  telegram_message_id BIGINT
);

CREATE UNIQUE INDEX uq_telegram_open_attendance_window
  ON public.telegram_attendance_windows(live_class_id, telegram_chat_id)
  WHERE status = 'open';

CREATE TABLE public.telegram_attendance_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attendance_window_id UUID NOT NULL REFERENCES public.telegram_attendance_windows(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  telegram_user_id BIGINT NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attendance_window_id, student_id)
);

CREATE INDEX idx_telegram_attendance_windows_due
  ON public.telegram_attendance_windows(status, closes_at)
  WHERE status = 'open';

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'livekit'
  CHECK (source IN ('livekit', 'telegram', 'manual'));

-- Called only with the service role by the Telegram webhook handler. It keeps
-- an attendance callback idempotent and ensures the student is enrolled in the
-- class's course/programme before Kanvise records a check-in.
CREATE OR REPLACE FUNCTION public.record_telegram_attendance_checkin(
  p_window_id UUID,
  p_telegram_user_id BIGINT,
  p_chat_id BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_window public.telegram_attendance_windows%ROWTYPE;
  v_identity public.telegram_identities%ROWTYPE;
  v_class public.live_classes%ROWTYPE;
  v_course public.courses%ROWTYPE;
  v_checkin_id UUID;
BEGIN
  SELECT * INTO v_window FROM public.telegram_attendance_windows WHERE id = p_window_id FOR UPDATE;
  IF NOT FOUND OR v_window.status <> 'open' OR v_window.closes_at < now() OR v_window.telegram_chat_id <> p_chat_id THEN
    RAISE EXCEPTION 'ATTENDANCE_WINDOW_CLOSED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_identity FROM public.telegram_identities
  WHERE school_id = v_window.school_id
    AND telegram_user_id = p_telegram_user_id
    AND reminders_enabled = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TELEGRAM_IDENTITY_NOT_LINKED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_class FROM public.live_classes WHERE id = v_window.live_class_id AND school_id = v_window.school_id;
  SELECT * INTO v_course FROM public.courses WHERE id = v_class.course_id AND school_id = v_window.school_id;
  IF NOT EXISTS (
    SELECT 1 FROM public.enrolments e
    WHERE e.school_id = v_window.school_id
      AND e.student_id = v_identity.user_id
      AND (e.course_id = v_course.id OR e.sub_programme_id = v_course.sub_programme_id OR e.programme_id = v_course.programme_id)
  ) THEN
    RAISE EXCEPTION 'STUDENT_NOT_ENROLLED' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.telegram_attendance_checkins (attendance_window_id, student_id, telegram_user_id)
  VALUES (v_window.id, v_identity.user_id, p_telegram_user_id)
  ON CONFLICT (attendance_window_id, student_id) DO NOTHING
  RETURNING id INTO v_checkin_id;

  IF v_checkin_id IS NOT NULL THEN
    INSERT INTO public.attendance_records (school_id, live_class_id, student_id, joined_at, source)
    VALUES (v_window.school_id, v_window.live_class_id, v_identity.user_id, now(), 'telegram');
  END IF;

  UPDATE public.telegram_identities SET last_interaction_at = now(), updated_at = now() WHERE id = v_identity.id;
  RETURN jsonb_build_object('checked_in', v_checkin_id IS NOT NULL, 'student_id', v_identity.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.record_telegram_attendance_checkin(UUID, BIGINT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_telegram_attendance_checkin(UUID, BIGINT, BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.record_telegram_attendance_checkin(UUID, BIGINT, BIGINT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.record_telegram_attendance_checkin(UUID, BIGINT, BIGINT) TO service_role;

ALTER TABLE public.telegram_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_connection_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_attendance_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_attendance_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_challenges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.telegram_chats, public.telegram_identities, public.telegram_connection_codes,
  public.telegram_deliveries, public.telegram_attendance_windows, public.telegram_attendance_checkins, public.telegram_link_challenges FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.telegram_chats, public.telegram_identities, public.telegram_connection_codes,
  public.telegram_deliveries, public.telegram_attendance_windows, public.telegram_attendance_checkins, public.telegram_link_challenges TO service_role;
