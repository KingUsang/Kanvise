alter table public.payments
  add column if not exists checkout_idempotency_key uuid,
  add column if not exists paystack_authorization_url text,
  add column if not exists paystack_access_code text;

alter table public.payments
  add constraint payments_student_checkout_idempotency_key_key
  unique (student_id, checkout_idempotency_key);

comment on column public.payments.checkout_idempotency_key is
  'Client-generated key used to make checkout initialization safe to retry.';
