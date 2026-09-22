-- Grace Encounter Ledger — schema, RLS, and self-registration RPC
-- Run this once in the Supabase SQL editor after creating the project.

create extension if not exists pg_trgm;
create extension if not exists "uuid-ossp";

-- ---------- Tables ----------

create table if not exists pickup_points (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

do $$ begin
  create type registrant_status as enum ('not_called','pending','confirmed','tentative');
exception when duplicate_object then null; end $$;

do $$ begin
  create type registrant_source as enum ('bulk_import','self_registered');
exception when duplicate_object then null; end $$;

create table if not exists registrants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone_raw text not null,
  phone_canonical text not null unique,
  status registrant_status not null default 'not_called',
  pickup_point_id uuid references pickup_points(id),
  note text,
  source registrant_source not null default 'bulk_import',
  possible_duplicate_of uuid references registrants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registrants_name_trgm on registrants using gin (name gin_trgm_ops);
create index if not exists registrants_phone_trgm on registrants using gin (phone_canonical gin_trgm_ops);
create index if not exists registrants_status_idx on registrants (status);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+[.][A-Za-z]+$'),
  role text not null check (role in ('caller','admin')),
  created_at timestamptz not null default now()
);

create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists registrants_set_updated_at on registrants;
create trigger registrants_set_updated_at before update on registrants
for each row execute function set_updated_at();

-- ---------- Phone normalization (Kenyan numbers -> 2547XXXXXXXX / 2541XXXXXXXX) ----------

create or replace function normalize_ke_phone(raw text) returns text as $$
declare
  digits text;
  national text;
begin
  if raw is null then return null; end if;
  if raw ~ '[A-Za-z]' then return null; end if; -- a real phone number never contains a letter
  digits := regexp_replace(raw, '\D', '', 'g');
  if digits = '' then return null; end if;

  if length(digits) = 12 and left(digits, 3) = '254' then
    national := substring(digits from 4);
  elsif length(digits) = 10 and left(digits, 1) = '0' then
    national := substring(digits from 2);
  elsif length(digits) = 9 then
    national := digits;
  else
    return null;
  end if;

  -- Real Kenyan mobile ranges only: 07xxxxxxxx (all networks) or 011xxxxxxx
  -- (Telkom/Faiba/Equitel). Anything else — including digit strings pulled
  -- from student IDs, dates, etc. that happen to be 9-12 digits — is rejected
  -- rather than guessed at.
  if left(national, 1) = '7' or left(national, 2) = '11' then
    return '254' || national;
  end if;

  return null;
end;
$$ language plpgsql immutable;

-- ---------- Row Level Security ----------

alter table registrants enable row level security;
alter table pickup_points enable row level security;
alter table admin_users enable row level security;

create or replace function is_admin_user() returns boolean as $$
  select exists (
    select 1 from admin_users au
    where au.email = (auth.jwt() ->> 'email')
  );
$$ language sql stable security definer;

create or replace function is_super_admin() returns boolean as $$
  select exists (
    select 1 from admin_users au
    where au.email = (auth.jwt() ->> 'email') and au.role = 'admin'
  );
$$ language sql stable security definer;

drop policy if exists "admins select registrants" on registrants;
create policy "admins select registrants" on registrants for select
  using (is_admin_user());

drop policy if exists "admins insert registrants" on registrants;
create policy "admins insert registrants" on registrants for insert
  with check (is_admin_user());

drop policy if exists "admins update registrants" on registrants;
create policy "admins update registrants" on registrants for update
  using (is_admin_user());

drop policy if exists "admins all pickup_points" on pickup_points;
create policy "admins all pickup_points" on pickup_points for all
  using (is_admin_user()) with check (is_admin_user());

drop policy if exists "supers manage admin_users" on admin_users;
create policy "supers manage admin_users" on admin_users for all
  using (is_super_admin()) with check (is_super_admin());

drop policy if exists "self read own admin row" on admin_users;
create policy "self read own admin row" on admin_users for select
  using (email = (auth.jwt() ->> 'email'));

-- ---------- Public read (name + phone only, no status) ----------

create or replace view public_registrants as
  select id, name, phone_canonical from registrants;

grant select on public_registrants to anon, authenticated;

-- ---------- Self-registration RPC (used by both the public form and bulk import) ----------

create or replace function register_person(p_name text, p_phone text, p_source registrant_source default 'self_registered')
returns table(result text, id uuid) as $$
declare
  v_phone text;
  v_existing uuid;
  v_new_id uuid;
  v_possible_dup uuid;
begin
  v_phone := normalize_ke_phone(p_phone);

  if v_phone is null then
    return query select 'invalid_phone'::text, null::uuid;
    return;
  end if;

  select r.id into v_existing from registrants r where r.phone_canonical = v_phone;
  if v_existing is not null then
    return query select 'duplicate'::text, v_existing;
    return;
  end if;

  -- Same-ish name, different phone number: not an auto-merge (phone is the
  -- only thing we trust as a strict identity key — two "David Wambua"s are a
  -- real possibility) but flagged so an admin can eyeball it, per the
  -- accuracy requirement: never silently guess, always surface for review.
  select r.id into v_possible_dup
  from registrants r
  where r.phone_canonical <> v_phone
    and similarity(r.name, trim(p_name)) > 0.45
  order by similarity(r.name, trim(p_name)) desc
  limit 1;

  insert into registrants (name, phone_raw, phone_canonical, source, possible_duplicate_of)
  values (trim(p_name), p_phone, v_phone, p_source, v_possible_dup)
  returning registrants.id into v_new_id;

  return query select 'inserted'::text, v_new_id;
end;
$$ language plpgsql security definer;

grant execute on function register_person(text, text, registrant_source) to anon, authenticated;
grant execute on function normalize_ke_phone(text) to anon, authenticated;

-- ---------- Seed: starter pickup points (rename/add in the admin panel any time) ----------
insert into pickup_points (name) values ('Nakuru'), ('Egerton')
on conflict do nothing;

-- ---------- Realtime ----------
-- Required for cross-device live sync: Supabase only broadcasts postgres_changes
-- for tables explicitly added to this publication. Without this, the admin
-- dashboard's realtime subscription silently receives nothing.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table registrants;
  end if;
exception when duplicate_object then null; end $$;

-- ---------- Event info: public FAQ + venue pin (admin-editable) ----------

create table if not exists event_info (
  id boolean primary key default true check (id),
  venue_name text,
  venue_lat double precision,
  venue_lng double precision,
  faq jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

drop trigger if exists event_info_set_updated_at on event_info;
create trigger event_info_set_updated_at before update on event_info
for each row execute function set_updated_at();

alter table event_info enable row level security;

drop policy if exists "public reads event_info" on event_info;
create policy "public reads event_info" on event_info for select using (true);

drop policy if exists "admins update event_info" on event_info;
create policy "admins update event_info" on event_info for update
  using (is_admin_user()) with check (is_admin_user());

grant select on event_info to anon, authenticated;
grant update on event_info to authenticated;

insert into event_info (id, venue_name, faq) values (
  true,
  'Uhuru Park, Nairobi',
  '[
    {"q":"Is the transport free?","a":"Yes — completely free from Nakuru to Nairobi and back. You only need to bring yourself."},
    {"q":"When is Grace Encounter?","a":"Saturday 26 and Sunday 27 September 2026, starting 10:00 AM both days."},
    {"q":"Where is it happening?","a":"Uhuru Park, Nairobi."},
    {"q":"Is entry free?","a":"Yes, entry to the event itself is free."},
    {"q":"Do I need to register more than once?","a":"No — search your name or phone above first. If you are not listed, add yourself once using the form below."}
  ]'::jsonb
) on conflict (id) do nothing;


-- ---------- Possible-duplicate review queue ----------

create or replace view possible_duplicates as
  select
    r.id, r.name, r.phone_canonical, r.created_at,
    o.id as matched_id, o.name as matched_name, o.phone_canonical as matched_phone
  from registrants r
  join registrants o on o.id = r.possible_duplicate_of
  order by r.created_at desc;

grant select on possible_duplicates to authenticated;

create or replace function dismiss_possible_duplicate(p_id uuid) returns void as $$
  update registrants set possible_duplicate_of = null where id = p_id and is_admin_user();
$$ language sql security definer;

grant execute on function dismiss_possible_duplicate(uuid) to authenticated;

-- ---------- Audit trail (admin actions) ----------

create table if not exists admin_actions (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  action text not null,
  registrant_id uuid references registrants(id) on delete set null,
  detail jsonb,
  created_at timestamptz not null default now()
);

alter table admin_actions enable row level security;

drop policy if exists "admins select admin_actions" on admin_actions;
create policy "admins select admin_actions" on admin_actions for select
  using (is_admin_user());

drop policy if exists "admins insert admin_actions" on admin_actions;
create policy "admins insert admin_actions" on admin_actions for insert
  with check (is_admin_user());

create index if not exists admin_actions_created_idx on admin_actions (created_at desc);

-- ---------- Deletion support (super-admins only, destructive) ----------

drop policy if exists "supers delete registrants" on registrants;
create policy "supers delete registrants" on registrants for delete
  using (is_super_admin());

-- Fix the self-referencing FK so removing a registrant who is someone else's
-- flagged "possible duplicate of" doesn't throw a foreign-key error — it
-- should just clear that flag on the record that referenced them.
do $$ begin
  alter table registrants drop constraint if exists registrants_possible_duplicate_of_fkey;
  alter table registrants
    add constraint registrants_possible_duplicate_of_fkey
    foreign key (possible_duplicate_of) references registrants(id) on delete set null;
exception when duplicate_object then null; end $$;
