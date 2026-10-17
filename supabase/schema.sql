-- Smart Campus Maintenance: database setup
-- Run this ONCE in a NEW Supabase project (SQL Editor -> New query -> Run).
-- Supabase may show a "table without RLS" pop-up. It is a false alarm:
-- every table below has Row Level Security switched on.

-- ============ 1. PROFILES (one row per user, holds the role) ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  role text not null default 'student'
    check (role in ('student', 'technician', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Automatically create a profile when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, new.raw_user_meta_data ->> 'full_name', new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ 2. EQUIPMENT ============
create table public.equipment (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null,
  location text not null,
  status text not null default 'working'
    check (status in ('working', 'faulty', 'under_repair', 'retired')),
  created_at timestamptz not null default now()
);

alter table public.equipment enable row level security;

-- ============ 3. HELPER: is the current user an admin? ============
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ============ 4. RULES for profiles and equipment ============
create policy "Admins can read all profiles"
  on public.profiles for select to authenticated
  using (public.is_admin());

create policy "Logged-in users can view equipment"
  on public.equipment for select to authenticated
  using (true);

create policy "Admins can add equipment"
  on public.equipment for insert to authenticated
  with check (public.is_admin());

create policy "Admins can edit equipment"
  on public.equipment for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ============ 5. COMPLAINTS ============
create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references public.equipment(id) on delete restrict,
  reported_by uuid not null default auth.uid() references public.profiles(id),
  description text not null,
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'resolved')),
  photo_path text,
  assigned_to uuid references public.profiles(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.complaints enable row level security;

create policy "Users can report issues"
  on public.complaints for insert to authenticated
  with check (
    reported_by = (select auth.uid())
    and status = 'pending'
    and assigned_to is null
    and resolved_at is null
  );

create policy "Users can view relevant complaints"
  on public.complaints for select to authenticated
  using (
    reported_by = (select auth.uid())
    or assigned_to = (select auth.uid())
    or public.is_admin()
  );

create policy "Admins can update complaints"
  on public.complaints for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Fill in the resolved date automatically
create or replace function public.set_resolved_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'resolved' and old.status is distinct from 'resolved' then
    new.resolved_at := now();
  elsif new.status <> 'resolved' then
    new.resolved_at := null;
  end if;
  return new;
end;
$$;

create trigger complaints_set_resolved_at
  before update on public.complaints
  for each row execute function public.set_resolved_at();

-- ============ 6. PHOTO STORAGE (private bucket, 10 MB, images only) ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'complaint-photos',
  'complaint-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

create policy "Users can upload photos to their own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can view their own photos, admins can view all"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'complaint-photos'
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_admin()
    )
  );

create policy "Users can delete their own photos"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'complaint-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- ============ 7. MAKE YOURSELF AN ADMIN (run after you sign up) ============
-- Remove the two dashes and use your own sign-up email:
-- update public.profiles set role = 'admin' where email = 'you@example.com';
