CREATE TABLE public.registration_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('student')),
  return_to text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  consumed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.registration_intents ENABLE ROW LEVEL SECURITY;
