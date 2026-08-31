-- Africa Connect — Supabase schema
--
-- Run this once against a fresh Supabase project (SQL Editor → New query → paste → Run).
-- It is safe to re-run: every statement is guarded with IF NOT EXISTS / OR REPLACE.
--
-- After running this, copy your project's URL and anon key into `.env.local`
-- as VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (see .env.example). The app
-- falls back to local mock storage automatically if those are unset, so this
-- script is entirely optional for local development.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- profiles — one row per auth.users entry, holding app-specific fields
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('farmer', 'buyer')),
  phone text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a new auth user signs up, reading the
-- full_name/role passed in via `options.data` on supabase.auth.signUp().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'role', 'buyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- crop_listings — the marketplace catalog
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.crop_listings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  crop_name text not null,
  category text not null,
  location text not null,
  available_tons numeric not null default 0,
  unit_price_usd numeric not null default 0,
  farmer_id uuid references public.profiles (id) on delete set null,
  certifications text[] not null default '{}',
  compliance_note text,
  export_monopoly boolean not null default false,
  status text not null default 'Available' check (status in ('Available', 'Sold Out', 'In Transit')),
  verified boolean not null default false,
  image_url text,
  harvest_date date,
  created_at timestamptz not null default now()
);

create index if not exists crop_listings_farmer_id_idx on public.crop_listings (farmer_id);

-- ─────────────────────────────────────────────────────────────────────────
-- conversations — one thread per (buyer, listing) pair
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  crop_id uuid not null references public.crop_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (buyer_id, crop_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- messages — chat + counter-offer + escrow-request events within a thread
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  text text not null,
  price_offer numeric,
  kind text not null default 'text' check (kind in ('text', 'offer', 'escrow')),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_id_idx on public.messages (conversation_id);

-- ─────────────────────────────────────────────────────────────────────────
-- orders — escrow trade lifecycle for a conversation
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.conversations (id) on delete set null,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  farmer_id uuid not null references public.profiles (id) on delete cascade,
  crop_id uuid references public.crop_listings (id) on delete set null,
  quantity_tons numeric not null,
  unit_price_usd numeric not null,
  logistics_usd numeric not null default 0,
  escrow_fee_usd numeric not null default 0,
  total_amount numeric not null default 0,
  escrow_status text not null default 'Inquiry Sent'
    check (escrow_status in ('Inquiry Sent', 'Escrow Funded', 'Logistics Scheduled', 'Delivered & Released')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_buyer_id_idx on public.orders (buyer_id);
create index if not exists orders_farmer_id_idx on public.orders (farmer_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- watchlist — buyer bookmarks on listings
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  crop_id uuid not null references public.crop_listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, crop_id)
);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.crop_listings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.orders enable row level security;
alter table public.watchlist enable row level security;

-- profiles: readable by any signed-in user (names shown on listings/threads); writable only by the owner
drop policy if exists "profiles are readable by authenticated users" on public.profiles;
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- crop_listings: the marketplace is public to read; only the owning farmer can write
drop policy if exists "listings are publicly readable" on public.crop_listings;
create policy "listings are publicly readable"
  on public.crop_listings for select
  using (true);

drop policy if exists "farmers can insert their own listings" on public.crop_listings;
create policy "farmers can insert their own listings"
  on public.crop_listings for insert
  to authenticated
  with check (auth.uid() = farmer_id);

drop policy if exists "farmers can update their own listings" on public.crop_listings;
create policy "farmers can update their own listings"
  on public.crop_listings for update
  to authenticated
  using (auth.uid() = farmer_id);

drop policy if exists "farmers can delete their own listings" on public.crop_listings;
create policy "farmers can delete their own listings"
  on public.crop_listings for delete
  to authenticated
  using (auth.uid() = farmer_id);

-- conversations: only the two participants can see or create their thread
drop policy if exists "participants can read their conversations" on public.conversations;
create policy "participants can read their conversations"
  on public.conversations for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = farmer_id);

drop policy if exists "buyers can start conversations" on public.conversations;
create policy "buyers can start conversations"
  on public.conversations for insert
  to authenticated
  with check (auth.uid() = buyer_id);

-- messages: only participants of the parent conversation can read/write
drop policy if exists "participants can read their messages" on public.messages;
create policy "participants can read their messages"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.farmer_id)
    )
  );

drop policy if exists "participants can send messages" on public.messages;
create policy "participants can send messages"
  on public.messages for insert
  to authenticated
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.buyer_id or auth.uid() = c.farmer_id)
    )
  );

-- orders: only the buyer/farmer on the trade can see or update it
drop policy if exists "participants can read their orders" on public.orders;
create policy "participants can read their orders"
  on public.orders for select
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = farmer_id);

drop policy if exists "buyers can create orders" on public.orders;
create policy "buyers can create orders"
  on public.orders for insert
  to authenticated
  with check (auth.uid() = buyer_id);

drop policy if exists "participants can update their orders" on public.orders;
create policy "participants can update their orders"
  on public.orders for update
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = farmer_id);

-- watchlist: private to the owning buyer
drop policy if exists "users manage their own watchlist" on public.watchlist;
create policy "users manage their own watchlist"
  on public.watchlist for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime — stream inserts/updates to subscribed clients
-- ─────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crop_listings'
  ) then
    alter publication supabase_realtime add table public.crop_listings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;
