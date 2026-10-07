-- Headspot: inline threaded comments (Supabase store) + private package/template publishing.
-- Idempotent: safe to run repeatedly.

-- ---------------------------------------------------------------------------
-- 1. project_comments: one row per thread, replies in a jsonb array.
-- ---------------------------------------------------------------------------
create table if not exists public.project_comments (
  id         uuid primary key,
  project_id uuid not null references public.projects (id) on delete cascade,
  path       text not null,
  from_pos   integer not null,
  to_pos     integer not null,
  text       text not null,
  author     text,
  ts         bigint not null default (extract(epoch from now()) * 1000)::bigint,
  resolved   boolean not null default false,
  replies    jsonb not null default '[]'::jsonb
);

create index if not exists project_comments_project_idx
  on public.project_comments (project_id);

alter table public.project_comments enable row level security;

drop policy if exists project_comments_owner on public.project_comments;
create policy project_comments_owner on public.project_comments
  for all to authenticated
  using (
    project_id in (select id from public.projects where owner_id = auth.uid())
  )
  with check (
    project_id in (select id from public.projects where owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- 2. package_config on projects: name/version/description/entrypoint/template.
-- ---------------------------------------------------------------------------
alter table public.projects add column if not exists package_config jsonb;

-- ---------------------------------------------------------------------------
-- 3. package_versions: release index for the private_packages bucket.
-- ---------------------------------------------------------------------------
create table if not exists public.package_versions (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references public.projects (id) on delete set null,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  version     text not null,
  description text not null default '',
  entrypoint  text not null default 'main.typ',
  is_template boolean not null default false,
  storage_path text not null,
  created_at  timestamptz not null default now(),
  unique (owner_id, name, version)
);

create index if not exists package_versions_owner_idx
  on public.package_versions (owner_id, created_at desc);

alter table public.package_versions enable row level security;

drop policy if exists package_versions_owner on public.package_versions;
create policy package_versions_owner on public.package_versions
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- 4. private_packages bucket: tarballs at <owner_id>/<name>-<version>.tar.gz.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('private_packages', 'private_packages', false)
on conflict (id) do nothing;

drop policy if exists private_packages_select_own on storage.objects;
create policy private_packages_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'private_packages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists private_packages_insert_own on storage.objects;
create policy private_packages_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'private_packages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists private_packages_update_own on storage.objects;
create policy private_packages_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'private_packages'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'private_packages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists private_packages_delete_own on storage.objects;
create policy private_packages_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'private_packages'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
