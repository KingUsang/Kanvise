-- Message channels (18 NTF-03 held messages, NTF-04 email rules; 20 DM-15).
--
-- Three API-only tables and the functions that must change them atomically:
--
--   held_messages             a message caused by an action with an Undo toast,
--                             waiting until the undo window closes.
--   notification_preferences  a person's switches (12 CFG-N, 09 SA-10 rows).
--   unsubscribe_tokens        the token behind an email's unsubscribe link,
--                             stored only as a sha-256 hash.
--
-- DM-15 suggested a release_at column on notification_deliveries. Held messages
-- live in their own table instead, because a held message exists before its
-- recipients are resolved: notification_deliveries rows are per recipient and
-- are written only when the message is finally delivered.
--
-- Everything is service-role only (standard 04): RLS on, no access for PUBLIC,
-- anon or authenticated. The browser reaches these through Hono.

-- Held messages ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.held_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  -- The person who pressed the action. Only they can undo it.
  actor_id uuid NOT NULL,
  -- What the message is about, for example 'lesson:<id>'. Held messages with
  -- the same subject in the same account are "last state wins" (NTF-03).
  subject_key text NOT NULL,
  event text NOT NULL,
  -- Identifiers only (standard 08): the builder reads current state at release.
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'held',
  release_at timestamptz NOT NULL,
  released_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT held_messages_status_check
    CHECK (status IN ('held', 'released', 'sent', 'cancelled', 'superseded', 'dropped', 'failed')),
  CONSTRAINT held_messages_subject_key_check CHECK (char_length(subject_key) BETWEEN 1 AND 200),
  CONSTRAINT held_messages_event_check CHECK (event ~ '^[a-z][a-z0-9_]{0,99}$'),
  CONSTRAINT held_messages_params_check CHECK (jsonb_typeof(params) = 'object'),
  CONSTRAINT held_messages_attempts_check CHECK (attempts >= 0),
  -- The actor must belong to the account the message is held in.
  CONSTRAINT held_messages_actor_membership_fkey FOREIGN KEY (actor_id, school_id)
    REFERENCES public.account_memberships (person_id, school_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_held_messages_status_release
  ON public.held_messages (status, release_at);
CREATE INDEX IF NOT EXISTS idx_held_messages_subject
  ON public.held_messages (school_id, subject_key, created_at);
CREATE INDEX IF NOT EXISTS idx_held_messages_actor_membership
  ON public.held_messages (actor_id, school_id);

ALTER TABLE public.held_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.held_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.held_messages TO service_role;

-- Undo: only the person who acted, only in the same account, only while held.
CREATE OR REPLACE FUNCTION public.cancel_held_message(
  p_id uuid,
  p_actor_id uuid,
  p_school_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE public.held_messages
    SET status = 'cancelled', updated_at = now()
    WHERE id = p_id AND actor_id = p_actor_id AND school_id = p_school_id AND status = 'held'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- The toast closed without Undo: the message may go now. It still waits while
-- a newer held message about the same subject exists.
CREATE OR REPLACE FUNCTION public.release_held_message_now(
  p_id uuid,
  p_actor_id uuid,
  p_school_id uuid
) RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH updated AS (
    UPDATE public.held_messages
    SET release_at = LEAST(release_at, now()), updated_at = now()
    WHERE id = p_id AND actor_id = p_actor_id AND school_id = p_school_id AND status = 'held'
    RETURNING 1
  )
  SELECT EXISTS (SELECT 1 FROM updated);
$$;

-- Claim held messages that may be sent now, in one statement.
--
-- For each subject, only the newest held message can go out (NTF-03, last state
-- wins). When its window has closed it is marked released and every older held
-- message of that subject is marked superseded, so an older message never sends
-- while a newer one exists. If the newer one is undone first, the newest
-- remaining held message becomes the candidate and goes as soon as its own
-- window has closed.
--
-- Also returned for another try: failed messages with attempts left, and
-- released messages whose worker stopped more than 10 minutes ago. Delivery is
-- idempotent per recipient and channel, so a repeat never sends twice.
CREATE OR REPLACE FUNCTION public.claim_due_held_messages(
  p_limit integer DEFAULT 50
) RETURNS SETOF public.held_messages
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  -- Released messages whose worker stopped and that used every attempt end here.
  UPDATE public.held_messages
  SET status = 'failed', last_error = COALESCE(last_error, 'Stopped after 5 attempts'), updated_at = now()
  WHERE status = 'released' AND released_at < now() - interval '10 minutes' AND attempts >= 5;

  WITH newest AS (
    SELECT DISTINCT ON (h.school_id, h.subject_key) h.id, h.school_id, h.subject_key, h.release_at
    FROM public.held_messages h
    WHERE h.status = 'held'
    ORDER BY h.school_id, h.subject_key, h.created_at DESC, h.id DESC
  ),
  candidates AS (
    SELECT n.id, n.release_at AS due_at FROM newest n WHERE n.release_at <= now()
    UNION ALL
    SELECT h.id, h.updated_at FROM public.held_messages h
    WHERE h.attempts < 5
      AND ((h.status = 'failed' AND h.updated_at <= now() - interval '30 seconds')
        OR (h.status = 'released' AND h.released_at < now() - interval '10 minutes'))
  ),
  picked AS (
    SELECT h.id, h.school_id, h.subject_key, h.status AS previous_status
    FROM public.held_messages h
    JOIN candidates c ON c.id = h.id
    WHERE h.status IN ('held', 'failed', 'released')
    ORDER BY c.due_at
    LIMIT GREATEST(p_limit, 1)
    FOR UPDATE OF h SKIP LOCKED
  ),
  superseded AS (
    UPDATE public.held_messages o
    SET status = 'superseded', updated_at = now()
    FROM picked p
    WHERE p.previous_status = 'held'
      AND o.school_id = p.school_id
      AND o.subject_key = p.subject_key
      AND o.status = 'held'
      AND o.id <> p.id
    RETURNING o.id
  )
  UPDATE public.held_messages h
  SET status = 'released', released_at = now(), attempts = h.attempts + 1, updated_at = now()
  FROM picked p
  WHERE h.id = p.id
  RETURNING h.*;
$$;

-- Notification preferences ----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  -- NULL for a Kanvise-wide row that belongs to no account (Kanvise tips).
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  -- A row key from api/src/notifications/rows.ts.
  row_key text NOT NULL,
  -- NULL means "not changed": the catalogue default applies.
  push_on boolean,
  email_on boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_row_key_check CHECK (row_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT notification_preferences_person_account_row_key
    UNIQUE NULLS NOT DISTINCT (person_id, school_id, row_key),
  CONSTRAINT notification_preferences_membership_fkey FOREIGN KEY (person_id, school_id)
    REFERENCES public.account_memberships (person_id, school_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_account
  ON public.notification_preferences (school_id, row_key);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_preferences FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

-- Unsubscribe tokens ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.unsubscribe_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE,
  row_key text NOT NULL,
  -- sha-256 hex of the random token. The raw token is only ever in the email.
  token_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  CONSTRAINT unsubscribe_tokens_token_hash_key UNIQUE (token_hash),
  CONSTRAINT unsubscribe_tokens_token_hash_check CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT unsubscribe_tokens_row_key_check CHECK (row_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT unsubscribe_tokens_expiry_check CHECK (expires_at > created_at),
  CONSTRAINT unsubscribe_tokens_membership_fkey FOREIGN KEY (person_id, school_id)
    REFERENCES public.account_memberships (person_id, school_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_person
  ON public.unsubscribe_tokens (person_id, school_id);
CREATE INDEX IF NOT EXISTS idx_unsubscribe_tokens_expires_at
  ON public.unsubscribe_tokens (expires_at);

ALTER TABLE public.unsubscribe_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.unsubscribe_tokens FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.unsubscribe_tokens TO service_role;

-- Switch a token's email row off (p_email_on = false) or back on (true, the
-- page's Undo), mark the token used, and return the row key. Returns no row
-- when the token is unknown, expired, or was first used more than a day ago,
-- so every one of those cases looks the same to the caller.
CREATE OR REPLACE FUNCTION public.apply_unsubscribe_token(
  p_token_hash text,
  p_email_on boolean
) RETURNS TABLE (applied_row_key text, applied_email_on boolean)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_token public.unsubscribe_tokens%ROWTYPE;
BEGIN
  SELECT * INTO v_token FROM public.unsubscribe_tokens t
  WHERE t.token_hash = p_token_hash
    AND t.expires_at > now()
    AND (t.used_at IS NULL OR t.used_at > now() - interval '1 day')
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  UPDATE public.unsubscribe_tokens
  SET used_at = COALESCE(used_at, now())
  WHERE id = v_token.id;

  INSERT INTO public.notification_preferences AS p (person_id, school_id, row_key, email_on)
  VALUES (v_token.person_id, v_token.school_id, v_token.row_key, p_email_on)
  ON CONFLICT ON CONSTRAINT notification_preferences_person_account_row_key
  DO UPDATE SET email_on = EXCLUDED.email_on, updated_at = now();

  applied_row_key := v_token.row_key;
  applied_email_on := p_email_on;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_held_message(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_held_message_now(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_due_held_messages(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_unsubscribe_token(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_held_message(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_held_message_now(uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_due_held_messages(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_unsubscribe_token(text, boolean) TO service_role;
