CREATE TABLE public.school_slug_redirects (
  old_slug text PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_slug_redirects_old_slug_format
    CHECK (old_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE INDEX school_slug_redirects_school_id_idx
  ON public.school_slug_redirects(school_id);

ALTER TABLE public.school_slug_redirects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.school_slug_redirects FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_school_slug_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.school_slug_redirects AS redirect
    WHERE redirect.old_slug = NEW.slug
      AND (TG_OP = 'INSERT' OR redirect.school_id <> NEW.id)
  ) THEN
    RAISE unique_violation USING MESSAGE = 'school slug is reserved by a historical redirect';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    -- Allow a centre to deliberately switch back to one of its own previous
    -- addresses, while keeping the address it just left recoverable.
    DELETE FROM public.school_slug_redirects
    WHERE old_slug = NEW.slug AND school_id = NEW.id;

    INSERT INTO public.school_slug_redirects(old_slug, school_id)
    VALUES (OLD.slug, NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_school_slug_history() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER protect_school_slug_history_on_insert
BEFORE INSERT ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.protect_school_slug_history();

CREATE TRIGGER protect_school_slug_history_on_update
BEFORE UPDATE OF slug ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.protect_school_slug_history();
