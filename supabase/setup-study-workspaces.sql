-- Applied through the Supabase connector on 2026-10-18.
-- Project: 3d-world-study-planner (bmgccobqrzeywefydyif).
-- Record of the applied create_private_study_workspaces migration.
-- Already applied to that project: do NOT run again there.

create table public.study_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

alter table public.study_workspaces enable row level security;

create policy "Users can access only their own workspace"
  on public.study_workspaces
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

revoke all on public.study_workspaces from public, anon;
grant select, insert, update, delete on public.study_workspaces to authenticated;

create function public.bump_study_workspace_revision()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger study_workspaces_before_update
before update on public.study_workspaces
for each row execute function public.bump_study_workspace_revision();
