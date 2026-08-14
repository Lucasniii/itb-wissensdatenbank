-- ITB: zentrale Wissensdatenbank mit Techniker- und Admin-Rollen
-- In Supabase Dashboard → SQL Editor als vollständiges Skript ausführen.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text not null default 'technician' check (role in ('technician', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.knowledge_entries (
  id uuid primary key default gen_random_uuid(),
  category text not null check (char_length(category) between 1 and 80),
  title text not null check (char_length(title) between 1 and 160),
  command text check (char_length(command) <= 200),
  content text not null check (char_length(content) between 1 and 3000),
  status text not null default 'draft' check (status in ('draft', 'published')),
  submitted_by uuid not null references auth.users(id) on delete cascade,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.knowledge_attachments (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.knowledge_entries(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 26214400),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_entries_status_idx on public.knowledge_entries(status);
create index if not exists knowledge_entries_submitted_by_idx on public.knowledge_entries(submitted_by);
create index if not exists knowledge_attachments_entry_id_idx on public.knowledge_attachments(entry_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists knowledge_entries_updated_at on public.knowledge_entries;
create trigger knowledge_entries_updated_at
  before update on public.knowledge_entries
  for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.knowledge_entries enable row level security;
alter table public.knowledge_attachments enable row level security;

drop policy if exists "Profiles are visible to their owner and admins" on public.profiles;
create policy "Profiles are visible to their owner and admins"
  on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "Published and permitted knowledge is readable" on public.knowledge_entries;
create policy "Published and permitted knowledge is readable"
  on public.knowledge_entries for select to authenticated
  using (status = 'published' or submitted_by = auth.uid() or public.is_admin());

drop policy if exists "Technicians submit drafts and admins create entries" on public.knowledge_entries;
create policy "Technicians submit drafts and admins create entries"
  on public.knowledge_entries for insert to authenticated
  with check ((submitted_by = auth.uid() and status = 'draft') or public.is_admin());

drop policy if exists "Technicians manage own drafts and admins manage all knowledge" on public.knowledge_entries;
create policy "Technicians manage own drafts and admins manage all knowledge"
  on public.knowledge_entries for update to authenticated
  using (public.is_admin() or (submitted_by = auth.uid() and status = 'draft'))
  with check (public.is_admin() or (submitted_by = auth.uid() and status = 'draft' and reviewed_by is null and reviewed_at is null));

drop policy if exists "Technicians delete own drafts and admins delete all knowledge" on public.knowledge_entries;
create policy "Technicians delete own drafts and admins delete all knowledge"
  on public.knowledge_entries for delete to authenticated
  using (public.is_admin() or (submitted_by = auth.uid() and status = 'draft'));

drop policy if exists "Permitted knowledge attachments are readable" on public.knowledge_attachments;
create policy "Permitted knowledge attachments are readable"
  on public.knowledge_attachments for select to authenticated
  using (exists (
    select 1 from public.knowledge_entries e
    where e.id = entry_id
      and (e.status = 'published' or e.submitted_by = auth.uid() or public.is_admin())
  ));

drop policy if exists "Technicians attach to own drafts and admins attach to all" on public.knowledge_attachments;
create policy "Technicians attach to own drafts and admins attach to all"
  on public.knowledge_attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.knowledge_entries e
      where e.id = entry_id
        and (public.is_admin() or (e.submitted_by = auth.uid() and e.status = 'draft'))
    )
  );

drop policy if exists "Technicians delete attachments on own drafts and admins delete all" on public.knowledge_attachments;
create policy "Technicians delete attachments on own drafts and admins delete all"
  on public.knowledge_attachments for delete to authenticated
  using (exists (
    select 1 from public.knowledge_entries e
    where e.id = entry_id
      and (public.is_admin() or (e.submitted_by = auth.uid() and e.status = 'draft'))
  ));

create or replace function public.can_read_knowledge_file(object_name text)
returns boolean
language sql
stable
security definer set search_path = public, storage
as $$
  select exists (
    select 1
    from public.knowledge_attachments a
    join public.knowledge_entries e on e.id = a.entry_id
    where a.storage_path = object_name
      and (e.status = 'published' or e.submitted_by = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.can_delete_knowledge_file(object_name text)
returns boolean
language sql
stable
security definer set search_path = public, storage
as $$
  select exists (
    select 1
    from public.knowledge_attachments a
    join public.knowledge_entries e on e.id = a.entry_id
    where a.storage_path = object_name
      and (public.is_admin() or (e.submitted_by = auth.uid() and e.status = 'draft'))
  );
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-files', 'knowledge-files', false, 26214400,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Knowledge files are readable when their entry is accessible" on storage.objects;
create policy "Knowledge files are readable when their entry is accessible"
  on storage.objects for select to authenticated
  using (bucket_id = 'knowledge-files' and public.can_read_knowledge_file(name));

drop policy if exists "Users upload knowledge files into their own folder" on storage.objects;
create policy "Users upload knowledge files into their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'knowledge-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Knowledge files can be deleted with their editable entry" on storage.objects;
create policy "Knowledge files can be deleted with their editable entry"
  on storage.objects for delete to authenticated
  using (bucket_id = 'knowledge-files' and public.can_delete_knowledge_file(name));

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.knowledge_entries to authenticated;
grant select, insert, delete on public.knowledge_attachments to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_read_knowledge_file(text) to authenticated;
grant execute on function public.can_delete_knowledge_file(text) to authenticated;

-- Semantische Suche: Embeddings für ausschließlich freigegebene Wissenseinträge.
-- Kein Versions-Pinning: Supabase verwendet für Extensions die aktuelle Default-Version.
create extension if not exists vector with schema extensions;

alter table public.knowledge_entries
  add column if not exists embedding extensions.vector(1536);

create or replace function public.match_knowledge_entries(
  query_embedding extensions.vector(1536),
  match_count integer default 6,
  match_threshold double precision default 0.20
)
returns table (
  id uuid,
  similarity double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    e.id,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.knowledge_entries e
  where e.status = 'published'
    and e.embedding is not null
    and 1 - (e.embedding <=> query_embedding) >= match_threshold
  order by e.embedding <=> query_embedding asc
  limit least(greatest(match_count, 1), 12);
$$;

grant execute on function public.match_knowledge_entries(extensions.vector, integer, double precision) to authenticated;

-- Nach der ersten Registrierung genau EINEN Account zum Admin machen:
-- update public.profiles set role = 'admin' where email = 'DEINE-ADMIN-EMAIL';
