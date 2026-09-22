-- PlugNmeet guest identities are deliberately not user_profiles. Keep a
-- single lightweight engagement row for each guest and public class.
ALTER TABLE public.guest_live_class_attendance
  DROP CONSTRAINT IF EXISTS guest_live_class_attendance_live_class_guest_key;

ALTER TABLE public.guest_live_class_attendance
  ADD CONSTRAINT guest_live_class_attendance_live_class_guest_key
  UNIQUE (live_class_id, guest_id);
