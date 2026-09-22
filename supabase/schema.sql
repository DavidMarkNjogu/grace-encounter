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
  list_number serial,
  possible_duplicate_of uuid references registrants(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registrants_name_trgm on registrants using gin (name gin_trgm_ops);
create index if not exists registrants_phone_trgm on registrants using gin (phone_canonical gin_trgm_ops);
create index if not exists registrants_status_idx on registrants (status);

create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
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
begin
  if raw is null then return null; end if;
  digits := regexp_replace(raw, '\D', '', 'g');

  if digits = '' then return null; end if;

  if length(digits) = 12 and left(digits, 3) = '254' then
    return digits;
  end if;

  if length(digits) = 10 and left(digits, 1) = '0' then
    return '254' || substring(digits from 2);
  end if;

  if length(digits) = 9 and left(digits, 1) in ('7','1') then
    return '254' || digits;
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

  insert into registrants (name, phone_raw, phone_canonical, source)
  values (trim(p_name), p_phone, v_phone, p_source)
  returning registrants.id into v_new_id;

  return query select 'inserted'::text, v_new_id;
end;
$$ language plpgsql security definer;

grant execute on function register_person(text, text, registrant_source) to anon, authenticated;
grant execute on function normalize_ke_phone(text) to anon, authenticated;

-- ---------- Seed: starter pickup points (rename/add in the admin panel any time) ----------
insert into pickup_points (name) values ('Nakuru'), ('Egerton')
on conflict do nothing;
