-- CredIQ — Supabase schema. Run in the Supabase SQL editor.
create table if not exists public.cases (
  id          text primary key,
  borrower    text,
  status      text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  data        jsonb not null
);
create index if not exists cases_created_idx on public.cases (created_at desc);

-- Only the backend (service-role key) touches this table. Enable RLS with no public policies,
-- so the anon key exposed to any browser can read nothing.
alter table public.cases enable row level security;

-- New Supabase projects no longer expose tables automatically: give the server key exactly what it needs.
grant usage on schema public to service_role;
grant select, insert, update on table public.cases to service_role;

-- Private bucket for uploaded financial statements.
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
