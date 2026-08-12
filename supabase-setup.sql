-- Eevee Box / shared Layla Hub Supabase project
-- Run once in Supabase SQL Editor.

create table if not exists public.ebox_pokemon (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  sort_order integer not null default 99,
  nickname text,
  species text not null,
  level integer not null default 1 check (level between 1 and 100),
  types text[] not null default '{}',
  ability text,
  ability_effect text,
  tera_type text,
  nature text,
  held_item text,
  notes text,
  current_moves jsonb not null default '[]'::jsonb,
  learnable_moves jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ebox_pokemon_owner_idx on public.ebox_pokemon(owner_id, sort_order);

create table if not exists public.ebox_battles (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  battle jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ebox_battles_owner_idx on public.ebox_battles(owner_id, updated_at desc);

-- Master tables are intentionally separate. The user-provided canonical lists can be imported later.
create table if not exists public.ebox_species_master (id text primary key, name text unique not null, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table if not exists public.ebox_moves_master (id text primary key, name text unique not null, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table if not exists public.ebox_abilities_master (id text primary key, name text unique not null, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
create table if not exists public.ebox_items_master (id text primary key, name text unique not null, data jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());

alter table public.ebox_pokemon enable row level security;
alter table public.ebox_battles enable row level security;
alter table public.ebox_species_master enable row level security;
alter table public.ebox_moves_master enable row level security;
alter table public.ebox_abilities_master enable row level security;
alter table public.ebox_items_master enable row level security;

drop policy if exists "ebox own pokemon" on public.ebox_pokemon;
create policy "ebox own pokemon" on public.ebox_pokemon for all to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
drop policy if exists "ebox own battles" on public.ebox_battles;
create policy "ebox own battles" on public.ebox_battles for all to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));

-- Master/reference data is readable by signed-in users. Writes are intentionally not granted to browser users.
drop policy if exists "ebox read species master" on public.ebox_species_master;
create policy "ebox read species master" on public.ebox_species_master for select to authenticated using (true);
drop policy if exists "ebox read moves master" on public.ebox_moves_master;
create policy "ebox read moves master" on public.ebox_moves_master for select to authenticated using (true);
drop policy if exists "ebox read abilities master" on public.ebox_abilities_master;
create policy "ebox read abilities master" on public.ebox_abilities_master for select to authenticated using (true);
drop policy if exists "ebox read items master" on public.ebox_items_master;
create policy "ebox read items master" on public.ebox_items_master for select to authenticated using (true);
