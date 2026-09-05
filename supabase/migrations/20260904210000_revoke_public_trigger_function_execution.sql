-- This function is invoked only by the enrolments trigger. It must not be
-- callable as an RPC by anonymous or signed-in clients.
REVOKE EXECUTE ON FUNCTION public.attach_enrolment_membership() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.attach_enrolment_membership() TO service_role;
