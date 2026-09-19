-- Server-rendered classroom pages. The original PDF remains in file_key;
-- generated pages are private R2 objects keyed by page number.
ALTER TABLE public.live_class_presentations
  ADD COLUMN IF NOT EXISTS page_image_keys jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS page_image_dimensions jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.live_class_presentations
  ADD CONSTRAINT live_class_presentations_page_image_keys_object
    CHECK (jsonb_typeof(page_image_keys) = 'object'),
  ADD CONSTRAINT live_class_presentations_page_image_dimensions_object
    CHECK (jsonb_typeof(page_image_dimensions) = 'object');
