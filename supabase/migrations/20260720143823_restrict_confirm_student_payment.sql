-- Supabase may grant functions in exposed schemas directly to API roles.
-- This RPC is an internal payment boundary and must only be callable with
-- the service-role credential after the API has verified Paystack.
REVOKE ALL ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) FROM anon;
REVOKE ALL ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_student_payment(TEXT, TEXT, BIGINT) TO service_role;
