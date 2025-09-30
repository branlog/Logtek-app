
-- LOGTEK 3.0 — Schema complet
-- Tables
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company text,
  phone text,
  default_address text,
  is_admin boolean default false,
  created_at timestamp with time zone default now()
);

create table if not exists public.addresses (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text,
  address text,
  created_at timestamp with time zone default now()
);

create table if not exists public.machines (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  model text,
  notes text,
  created_at timestamp with time zone default now()
);

create table if not exists public.gps_favorites (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete cascade,
  label text,
  lat double precision,
  lng double precision,
  created_at timestamp with time zone default now()
);

create table if not exists public.products (
  id bigserial primary key,
  category text,
  name text,
  "desc" text,
  price numeric,
  unit text,
  sku text,
  image text,
  active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.orders (
  id bigserial primary key,
  user_id uuid,
  total numeric,
  email text,
  phone text,
  address text,
  payload jsonb,
  gps_point jsonb,
  created_at timestamp with time zone default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.machines enable row level security;
alter table public.gps_favorites enable row level security;
alter table public.orders enable row level security;
alter table public.products enable row level security;

create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select coalesce((select is_admin from public.profiles p where p.id = uid), false);
$$;

-- Profiles
create policy if not exists "profiles read own or admin" on public.profiles for select using ( auth.uid() = id or public.is_admin(auth.uid()) );
create policy if not exists "profiles insert self" on public.profiles for insert with check ( auth.uid() = id or public.is_admin(auth.uid()) );
create policy if not exists "profiles update own or admin" on public.profiles for update using ( auth.uid() = id or public.is_admin(auth.uid()) );

-- Addresses
create policy if not exists "addresses read own or admin" on public.addresses for select using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "addresses insert own or admin" on public.addresses for insert with check ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "addresses update own or admin" on public.addresses for update using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "addresses delete own or admin" on public.addresses for delete using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

-- Machines
create policy if not exists "machines read own or admin" on public.machines for select using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "machines insert own or admin" on public.machines for insert with check ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "machines update own or admin" on public.machines for update using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "machines delete own or admin" on public.machines for delete using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

-- GPS favoris
create policy if not exists "gps_fav read own or admin" on public.gps_favorites for select using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "gps_fav insert own or admin" on public.gps_favorites for insert with check ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "gps_fav update own or admin" on public.gps_favorites for update using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "gps_fav delete own or admin" on public.gps_favorites for delete using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

-- Orders
create policy if not exists "orders read own or admin" on public.orders for select using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
create policy if not exists "orders insert any" on public.orders for insert with check ( true );

-- Products
create policy if not exists "products read all" on public.products for select using ( true );
create policy if not exists "products insert admin" on public.products for insert with check ( public.is_admin(auth.uid()) );
create policy if not exists "products update admin" on public.products for update using ( public.is_admin(auth.uid()) );
create policy if not exists "products delete admin" on public.products for delete using ( public.is_admin(auth.uid()) );

-- ====== SEED ADMIN (exécuté dans l'éditeur SQL Supabase) ======
-- Crée un utilisateur admin par défaut et profile admin.
-- ⚠️ L'éditeur SQL Supabase a les droits 'service-role', donc ça fonctionne ici.
do $$
declare
  new_user uuid;
begin
  -- créer l'utilisateur auth avec mot de passe
  select (auth.admin.create_user(
    email => 'admin@logtek.ca',
    password => 'test1234',
    email_confirm => true
  )).id into new_user;

  -- créer/mettre à jour le profil admin
  insert into public.profiles (id, company, phone, default_address, is_admin)
  values (new_user, 'Logtek Admin', '+1 418 894 3093', 'Témiscouata QC', true)
  on conflict (id) do update set is_admin = true;
end $$;

-- ====== SEED PRODUITS ======
insert into public.products (category,name,"desc",price,unit,sku,active) values
('Chaînes','Chaîne Oregon 20"','Chaîne tronçonneuse 0.325" 72 maillons',32.91,'unité','OR-20-72',true),
('Chaînes','Chaîne TriLink 20"','Chaîne tronçonneuse 3/8" 72 maillons',27.95,'unité','TL-20-72',true),
('Guides','Guide tronçonneuse 20"','Montage standard',95.00,'unité','BAR-20',true),
('Guides','Guide Harvester 28"','Usage pro',250.00,'unité','BAR-HV-28',true),
('Huiles','Huile hydraulique ISO 46 — 20 L','Anti-usure',85.00,'bidon 20 L','HYD-46-20L',true),
('Urée DEF','Urée (DEF) 10 L','ISO 22241',25.00,'bidon 10 L','DEF-10L',true),
('Filtres','Filtre à air','Selon modèle',45.00,'unité','FLT-AIR',true)
on conflict do nothing;
