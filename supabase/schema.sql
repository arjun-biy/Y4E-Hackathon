-- Tray Return Tracker database. Paste all of this into Supabase > SQL Editor and hit Run.
-- Safe to run again: it only creates what's missing.

create table if not exists schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null unique default upper(substr(md5(random()::text), 1, 6)),
  -- menu, foods, categories and reference photos, same shape the app keeps locally
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists members (
  user_id uuid not null references auth.users on delete cascade,
  school_id uuid not null references schools on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, school_id)
);

create table if not exists trays (
  id bigint generated always as identity primary key,
  school_id uuid not null references schools on delete cascade,
  served_on date not null,
  foods text[] not null,
  left_frac jsonb not null,           -- one number per food, null = student didn't take it
  vote smallint not null default -1,  -- index into the app's vote reasons, -1 = no vote
  sample boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists trays_school_day on trays (school_id, served_on);

-- every table is locked down; people only see schools they belong to
alter table schools enable row level security;
alter table members enable row level security;
alter table trays enable row level security;

create or replace function my_school_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select school_id from members where user_id = auth.uid()
$$;

drop policy if exists "read my schools" on schools;
create policy "read my schools" on schools for select using (id in (select my_school_ids()));
drop policy if exists "edit my schools" on schools;
create policy "edit my schools" on schools for update using (id in (select my_school_ids()));

drop policy if exists "read my memberships" on members;
create policy "read my memberships" on members for select using (user_id = auth.uid());

drop policy if exists "read trays" on trays;
create policy "read trays" on trays for select using (school_id in (select my_school_ids()));
drop policy if exists "add trays" on trays;
create policy "add trays" on trays for insert with check (school_id in (select my_school_ids()));
drop policy if exists "vote on trays" on trays;
create policy "vote on trays" on trays for update using (school_id in (select my_school_ids()));
drop policy if exists "delete trays" on trays;
create policy "delete trays" on trays for delete using (school_id in (select my_school_ids()));

-- making a school and joining one go through these so nobody can add themselves without the code
create or replace function create_school(school_name text, school_config jsonb default '{}'::jsonb)
returns schools language plpgsql security definer set search_path = public as $$
declare s schools;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  insert into schools (name, config) values (school_name, school_config) returning * into s;
  insert into members (user_id, school_id) values (auth.uid(), s.id);
  return s;
end $$;

create or replace function join_school(code text)
returns schools language plpgsql security definer set search_path = public as $$
declare s schools;
begin
  if auth.uid() is null then raise exception 'sign in first'; end if;
  select * into s from schools where join_code = upper(trim(code));
  if s.id is null then raise exception 'no school with that code'; end if;
  insert into members (user_id, school_id) values (auth.uid(), s.id) on conflict do nothing;
  return s;
end $$;

revoke all on function create_school(text, jsonb) from public, anon;
revoke all on function join_school(text) from public, anon;
grant execute on function create_school(text, jsonb) to authenticated;
grant execute on function join_school(text) to authenticated;
