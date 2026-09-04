-- Existing records remain purchasable to preserve current checkout behaviour.
-- New sub-programmes and courses are included-only unless an admin opts in.
alter table public.sub_programmes
  add column if not exists is_available_separately boolean not null default false;

alter table public.courses
  add column if not exists is_available_separately boolean not null default false;

update public.sub_programmes set is_available_separately = true;
update public.courses set is_available_separately = true;

comment on column public.sub_programmes.is_available_separately is
  'Whether students may purchase this sub-programme independently of its parent programme.';
comment on column public.courses.is_available_separately is
  'Whether students may purchase this course independently of a parent programme or sub-programme.';
