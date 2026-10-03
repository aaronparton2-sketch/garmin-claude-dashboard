-- Blood work panels. One row per blood draw; every marker lives in the `markers`
-- jsonb array so a future panel that adds or drops a test needs no migration.
--
-- WHY jsonb RATHER THAN A ROW PER MARKER: this is 2 draws a year, ~40 markers
-- each. A relational split buys nothing at that scale and costs a join on every
-- read, while the panel is always fetched whole anyway. The `key` inside each
-- marker is the stable trend join key - never rename one, or its history breaks.
--
-- WHY IT MUST LIVE HERE AND NOT IN THE APP BUNDLE: .vercelignore deliberately
-- keeps .env and your own data/ out of the upload so no health data or key is ever inlined
-- into the public JS. On Vercel the browser reaches this table only through the
-- cookie-gated /api/data proxy. Anything embedded client-side would be readable
-- by anyone who fetches the bundle, login screen or not.

create table if not exists public.blood_panels (
  id             uuid primary key default gen_random_uuid(),
  panel_date     date        not null unique,   -- unique so re-running an insert can upsert
  lab            text,
  lab_id         text,
  referrer       text,
  clinical_notes text,
  fasting        boolean,
  markers        jsonb       not null default '[]'::jsonb,
  lab_comments   jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

comment on table public.blood_panels is
  'Blood work results, one row per draw. markers = [{key,group,name,value,op,unit,range,flag,note}].';

create index if not exists blood_panels_date_idx on public.blood_panels (panel_date desc);

-- RLS on, and NO anon policy. The dashboard reads this through /api/data using
-- the service_role key, which bypasses RLS. Adding an anon read policy would
-- expose it to the anon key, which is exactly what the deploy setup avoids.
alter table public.blood_panels enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'blood_panels'
      and policyname = 'blood_panels_service_role_all'
  ) then
    create policy blood_panels_service_role_all
      on public.blood_panels for all to service_role
      using (true) with check (true);
  end if;
end $$;
