alter table public.payments
  add column if not exists checkout_idempotency_key uuid,
  add column if not exists paystack_authorization_url text,
  add column if not exists paystack_access_code text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payments_student_checkout_idempotency_key_key'
  ) then
    alter table public.payments
      add constraint payments_student_checkout_idempotency_key_key
      unique (student_id, checkout_idempotency_key);
  end if;
end $$;

comment on column public.payments.checkout_idempotency_key is
  'Client-generated key used to make checkout initialization safe to retry.';
