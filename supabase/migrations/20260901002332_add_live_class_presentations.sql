-- Original classroom PDFs are stored in private object storage. This table
-- contains only metadata and zoom-independent, page-relative annotations.
ALTER TABLE public.live_classes
  ADD COLUMN IF NOT EXISTS teaching_mode text NOT NULL DEFAULT 'whiteboard'
  CHECK (teaching_mode IN ('whiteboard', 'presentation'));

CREATE TABLE public.live_class_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  live_class_id uuid NOT NULL REFERENCES public.live_classes(id) ON DELETE CASCADE,
  uploaded_by uuid NOT NULL REFERENCES public.user_profiles(id),
  file_key text NOT NULL UNIQUE,
  filename text NOT NULL CHECK (char_length(filename) BETWEEN 1 AND 255),
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0 AND file_size_bytes <= 26214400),
  page_count integer NOT NULL CHECK (page_count BETWEEN 1 AND 50),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  current_page integer NOT NULL DEFAULT 1 CHECK (current_page >= 1),
  is_active boolean NOT NULL DEFAULT false,
  annotations jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT live_class_presentations_page_in_range CHECK (current_page <= page_count)
);

CREATE INDEX live_class_presentations_class_order_idx
  ON public.live_class_presentations(live_class_id, sort_order, created_at);
CREATE UNIQUE INDEX live_class_presentations_one_active_idx
  ON public.live_class_presentations(live_class_id) WHERE is_active;

ALTER TABLE public.live_class_presentations ENABLE ROW LEVEL SECURITY;

-- Kanvise's browser talks to the Hono API, not PostgREST. Keep this table
-- inaccessible to anon/authenticated even if the public schema is exposed.
REVOKE ALL ON TABLE public.live_class_presentations FROM public, anon, authenticated;
GRANT ALL ON TABLE public.live_class_presentations TO service_role;

CREATE OR REPLACE FUNCTION public.set_live_class_presentation_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_live_class_presentation_updated_at() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_live_class_presentation_updated_at() TO service_role;

DROP TRIGGER IF EXISTS set_live_class_presentations_updated_at ON public.live_class_presentations;
CREATE TRIGGER set_live_class_presentations_updated_at
  BEFORE UPDATE ON public.live_class_presentations
  FOR EACH ROW EXECUTE FUNCTION public.set_live_class_presentation_updated_at();
