-- These fields are part of the API and generated database contract but were
-- previously present only in the long-lived development database.
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS profile_photo_key TEXT;
