-- 1. Let admins change OTHER users' roles (and nothing else).
-- Only the "role" column can ever be updated, and never your own row.

revoke update on public.profiles from authenticated, anon;

grant update (role) on public.profiles to authenticated;

create policy "Admins can change roles of other users"
  on public.profiles
  for update
  to authenticated
  using (
    public.is_admin()
    and id <> (select auth.uid())
  )
  with check (
    public.is_admin()
    and id <> (select auth.uid())
  );

-- 2. Assignment rules:
-- a) a complaint can only be assigned to a technician
-- b) assigning a Pending complaint moves it to In progress automatically

create or replace function public.handle_complaint_assignment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.assigned_to is not null
     and new.assigned_to is distinct from old.assigned_to then

    if not exists (
      select 1
      from public.profiles
      where id = new.assigned_to
      and role = 'technician'
    ) then
      raise exception 'Complaints can only be assigned to technicians';
    end if;

    if old.status = 'pending'
       and new.status = 'pending' then
      new.status := 'in_progress';
    end if;

  end if;

  return new;
end;
$$;

create trigger complaints_auto_progress
before update on public.complaints
for each row
execute function public.handle_complaint_assignment();