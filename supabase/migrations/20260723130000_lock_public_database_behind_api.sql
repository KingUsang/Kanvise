-- Kanvise's application-data boundary is the Hono API. The browser uses
-- Supabase only for Auth, so anon/authenticated must not access public data or
-- RPCs directly. The API uses service_role and remains the sole data caller.

do $$
declare
  relation record;
begin
  for relation in
    select n.nspname as schema_name, c.relname as relation_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
  loop
    execute format(
      'alter table %I.%I enable row level security',
      relation.schema_name,
      relation.relation_name
    );
  end loop;
end
$$;

revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public
  revoke all privileges on tables from public, anon, authenticated;
alter default privileges in schema public
  revoke all privileges on sequences from public, anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant all privileges on sequences to service_role;
alter default privileges in schema public
  grant execute on functions to service_role;

-- These older trigger/helper functions predate the fixed-search-path rule.
-- Pinning the path prevents callers from shadowing referenced objects.
alter function public.update_modified_column() set search_path = pg_catalog, public;
alter function public.increment_user_sequence(text) set search_path = pg_catalog, public;
