-- Older hosted databases were created before user profile deactivation was
-- included in the canonical schema.
ALTER TABLE user_profiles
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_user_profiles_school_active
    ON user_profiles(school_id, is_active);
