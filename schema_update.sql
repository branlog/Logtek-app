
-- Add admin + gps if base exists
alter table public.profiles add column if not exists is_admin boolean default false;
alter table public.orders add column if not exists gps_point jsonb;

-- Products table
create table if not exists public.products ( id bigserial primary key, category text, name text, "desc" text, price numeric, unit text, sku text, image text, active boolean default true, created_at timestamp with time zone default now());

-- Helper function + policies for admin visibility
create or replace function public.is_admin(uid uuid)
returns boolean language sql stable as $$
  select coalesce((select is_admin from public.profiles p where p.id = uid), false);
$$;

do $$ begin
  alter table public.profiles enable row level security;
  alter table public.addresses enable row level security;
  alter table public.machines enable row level security;
  alter table public.orders enable row level security;
  alter table public.products enable row level security;
exception when others then null; end $$;

-- Policies
drop policy if exists "profiles read own or admin" on public.profiles;
create policy "profiles read own or admin" on public.profiles for select using ( auth.uid() = id or public.is_admin(auth.uid()) );
drop policy if exists "profiles insert self" on public.profiles;
create policy "profiles insert self" on public.profiles for insert with check ( auth.uid() = id or public.is_admin(auth.uid()) );
drop policy if exists "profiles update own or admin" on public.profiles;
create policy "profiles update own or admin" on public.profiles for update using ( auth.uid() = id or public.is_admin(auth.uid()) );

drop policy if exists "addresses read own or admin" on public.addresses;
create policy "addresses read own or admin" on public.addresses for select using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
drop policy if exists "addresses insert own or admin" on public.addresses;
create policy "addresses insert own or admin" on public.addresses for insert with check ( auth.uid() = user_id or public.is_admin(auth.uid()) );
drop policy if exists "addresses update own or admin" on public.addresses;
create policy "addresses update own or admin" on public.addresses for update using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
drop policy if exists "addresses delete own or admin" on public.addresses;
create policy "addresses delete own or admin" on public.addresses for delete using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

drop policy if exists "machines read own or admin" on public.machines;
create policy "machines read own or admin" on public.machines for select using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
drop policy if exists "machines insert own or admin" on public.machines;
create policy "machines insert own or admin" on public.machines for insert with check ( auth.uid() = user_id or public.is_admin(auth.uid()) );
drop policy if exists "machines update own or admin" on public.machines;
create policy "machines update own or admin" on public.machines for update using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
drop policy if exists "machines delete own or admin" on public.machines;
create policy "machines delete own or admin" on public.machines for delete using ( auth.uid() = user_id or public.is_admin(auth.uid()) );

drop policy if exists "orders read own or admin" on public.orders;
create policy "orders read own or admin" on public.orders for select using ( auth.uid() = user_id or public.is_admin(auth.uid()) );
drop policy if exists "orders insert any" on public.orders;
create policy "orders insert any" on public.orders for insert with check ( true );

drop policy if exists "products read all" on public.products;
create policy "products read all" on public.products for select using ( true );
drop policy if exists "products insert admin" on public.products;
create policy "products insert admin" on public.products for insert with check ( public.is_admin(auth.uid()) );
drop policy if exists "products update admin" on public.products;
create policy "products update admin" on public.products for update using ( public.is_admin(auth.uid()) );
drop policy if exists "products delete admin" on public.products;
create policy "products delete admin" on public.products for delete using ( public.is_admin(auth.uid()) );
