-- Older clients and the current account setup flow may omit outfit_colour.
-- Keep the column non-null while providing a stable default for new avatars.
ALTER TABLE public.avatar_configs
  ALTER COLUMN outfit_colour SET DEFAULT '#2563EB';
