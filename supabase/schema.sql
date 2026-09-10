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
--
-- This runs inside the SAME transaction as the `auth.users` insert — an
-- uncaught exception here rolls back the whole signup and Supabase Auth
-- surfaces it to the client as the generic "Database error saving new user",
-- with no detail. Common causes: `role` outside the allowed check-constraint
-- values, an empty-string `full_name`, or a retried signup colliding with
-- the `profiles.email` unique constraint (`on conflict (id)` only guards
-- against an `id` collision, not an `email` one). The exception handler
-- below means none of those can ever fail the auth account creation itself —
-- worst case, the profile row is missing or stale, which
-- src/context/AuthContext.tsx's fetchProfile already tolerates, and can
-- self-heal via its client-side upsert fallback.
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
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
    case
      when new.raw_user_meta_data ->> 'role' in ('farmer', 'buyer') then new.raw_user_meta_data ->> 'role'
      else 'buyer'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        role = excluded.role;
  return new;
exception
  when others then
    raise warning 'handle_new_user: could not create/update profile for % (%): % (%)', new.id, new.email, sqlerrm, sqlstate;
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

-- buyer_id is already covered by the leftmost column of the unique(buyer_id,
-- crop_id) constraint above; farmer_id has no such coverage, and
-- MessagingContext's `.or(buyer_id.eq.X, farmer_id.eq.X)` query needs both sides indexed.
create index if not exists idx_conversations_farmer_id on public.conversations (farmer_id);

-- ─────────────────────────────────────────────────────────────────────────
-- messages — chat + counter-offer + escrow-request events within a thread
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  text text not null,
  price_offer numeric,
  kind text not null default 'text' check (kind in ('text', 'offer', 'offer_accepted', 'escrow')),
  created_at timestamptz not null default now()
);

-- Upgrades a messages table created before 'offer_accepted' was a valid kind.
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check
  check (kind in ('text', 'offer', 'offer_accepted', 'escrow'));

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
  -- Payment gateway reference (Flutterwave tx_ref, or a simulated sandbox id) set when escrow is funded.
  receipt_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrades an orders table created before receipt_reference existed.
alter table public.orders add column if not exists receipt_reference text;

-- Enforce one escrow lifecycle per conversation. PostgreSQL permits multiple
-- NULL values while preventing concurrent requests from creating duplicates.
create unique index if not exists orders_conversation_id_key on public.orders (conversation_id);

-- Upgrades an orders table whose escrow_status check constraint predates (or
-- otherwise diverged from) this 4-stage lifecycle — `create table if not
-- exists` above never re-applies to an already-existing table, so without
-- this, a live project created before 'Inquiry Sent' was added here would
-- reject every new order with "violates check constraint
-- orders_escrow_status_check". Same pattern as messages_kind_check below.
alter table public.orders drop constraint if exists orders_escrow_status_check;
alter table public.orders add constraint orders_escrow_status_check
  check (escrow_status in ('Inquiry Sent', 'Escrow Funded', 'Logistics Scheduled', 'Delivered & Released'));

-- Fixes a live column default ('Initiated') that predates the 4-stage
-- lifecycle above and isn't even one of its allowed values — confirmed via
-- `supabase db pull --declarative` on 2026-09-10. Harmless as long as every
-- INSERT sets escrow_status explicitly (LocalOrdersProvider and
-- SupabaseOrdersProvider.createOrder both already do), but a bare `insert
-- into orders (...)` that omitted it would violate orders_escrow_status_check
-- outright rather than silently defaulting to something wrong.
alter table public.orders alter column escrow_status set default 'Inquiry Sent';

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
-- payment_attempts — server-authoritative record of what a checkout is
-- expected to charge, created by api/create-payment-attempt.ts BEFORE any
-- provider checkout opens. Webhooks verify the amount/currency they receive
-- against this row instead of trusting the order (which is denominated in
-- USD and may be paid in a different settlement currency) or the client.
-- Written exclusively by the service-role client (see api/_lib/supabaseAdmin.ts);
-- there is deliberately no insert/update policy for `authenticated`.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  provider text not null check (provider in ('stripe', 'flutterwave', 'paystack')),
  amount numeric not null,
  currency text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),
  provider_reference text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create index if not exists payment_attempts_order_id_idx on public.payment_attempts (order_id);
create index if not exists payment_attempts_buyer_id_idx on public.payment_attempts (buyer_id);
-- A given order can have multiple attempts (retries, cancelled checkouts),
-- but at most one may ever reach 'confirmed' — enforced with a partial
-- unique index rather than a CHECK, since CHECK can't see other rows.
create unique index if not exists payment_attempts_one_confirmed_per_order
  on public.payment_attempts (order_id) where status = 'confirmed';

alter table public.payment_attempts enable row level security;

drop policy if exists "buyers can read their own payment attempts" on public.payment_attempts;
create policy "buyers can read their own payment attempts"
  on public.payment_attempts for select
  to authenticated
  using (auth.uid() = buyer_id);

-- ─────────────────────────────────────────────────────────────────────────
-- processed_webhook_events — replay/idempotency guard shared by all three
-- payment webhooks. Each handler inserts (provider, event_id) before acting
-- on an event; a unique-violation means this exact event was already
-- processed, so the handler acknowledges it and does nothing further. No
-- policies at all — this table is only ever touched by the service-role
-- client, which bypasses RLS entirely, so `authenticated`/`anon` get no
-- access rather than a permissive-looking policy that never actually runs.
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.processed_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  event_id text not null,
  created_at timestamptz not null default now(),
  unique (provider, event_id)
);

alter table public.processed_webhook_events enable row level security;

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
-- transactions — completed gateway charges (currently: Paystack `charge.success`)
-- ─────────────────────────────────────────────────────────────────────────
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  provider text not null default 'paystack' check (provider in ('paystack')),
  user_id uuid references public.profiles (id) on delete set null,
  email text not null,
  amount numeric not null,
  currency text not null default 'NGN',
  status text not null default 'success' check (status in ('success', 'failed', 'pending')),
  raw_event jsonb,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- profiles_public — narrow, publicly-readable projection of profiles, so
-- anonymous Marketplace visitors can see farmer names/avatars without
-- widening profiles' own RLS (which stays authenticated-only below). Scoped
-- to farmers who actually have a listing; excludes role, email, and phone.
-- CropContext.tsx queries this directly for anonymous requests rather than
-- relying on PostgREST FK-embedding through a view.
-- ─────────────────────────────────────────────────────────────────────────
create or replace view public.profiles_public as
select p.id, p.full_name, p.avatar_url
from public.profiles p
where exists (
  select 1 from public.crop_listings cl where cl.farmer_id = p.id
);

grant select on public.profiles_public to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.crop_listings enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.orders enable row level security;
alter table public.watchlist enable row level security;
alter table public.transactions enable row level security;

-- profiles: readable by any signed-in user (names shown on listings/threads); writable only by the owner
drop policy if exists "profiles are readable by authenticated users" on public.profiles;
create policy "profiles are readable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

-- Normally unnecessary — handle_new_user() (security definer) creates the
-- row — but this lets AuthContext's client-side upsert fallback self-heal a
-- signup whose trigger row never landed, without needing another security
-- definer function.
drop policy if exists "users can insert their own profile" on public.profiles;
create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

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

-- Tightened per PAYMENT_SECURITY_AUDIT.md's Critical finding: the previous
-- version checked only `buyer_id`, so a client could insert an order that
-- was already "funded" — skipping the whole escrow flow. Every new order
-- must now start at 'Inquiry Sent' with no receipt, no matter what a client
-- sends; only a webhook (service_role, bypasses RLS) can ever set those.
drop policy if exists "buyers can create orders" on public.orders;
create policy "buyers can create orders"
  on public.orders for insert
  to authenticated
  with check (
    auth.uid() = buyer_id
    and escrow_status = 'Inquiry Sent'
    and receipt_reference is null
  );

-- Still lets a participant advance non-financial lifecycle fields (this
-- policy's USING clause), but see orders_guard_financial_writes below —
-- that trigger independently blocks any change to escrow_status,
-- unit_price_usd, logistics_usd, escrow_fee_usd, total_amount, or
-- receipt_reference from any role except service_role, regardless of what
-- this policy alone would otherwise permit. Two layers on purpose: RLS
-- policies compose with OR within a command and are easy to widen by
-- accident later, so the financial-field guard does not rely on this
-- policy staying narrow.
drop policy if exists "participants can update their orders" on public.orders;
create policy "participants can update their orders"
  on public.orders for update
  to authenticated
  using (auth.uid() = buyer_id or auth.uid() = farmer_id);

-- ─────────────────────────────────────────────────────────────────────────
-- orders_guard_financial_writes — the actual fix for the audit's Critical
-- finding ("participants can author payment state"). RLS policies can only
-- see the NEW row in a WITH CHECK, not compare it against OLD, so the
-- "escrow_status can move between these two specific stages, but never
-- becomes 'Escrow Funded' from a client, and the money fields never change
-- from a client at all" rule has to live in a trigger, not a policy.
--
-- auth.role() reflects the Postgres role PostgREST/GoTrue sets per request:
-- 'service_role' for the admin client the webhooks use (api/_lib/supabaseAdmin.ts),
-- 'authenticated' for every real buyer/farmer session. Only the former may
-- change a financial field or move escrow_status into 'Escrow Funded'.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.guard_order_financial_writes()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  is_service_role boolean := coalesce(auth.role(), 'service_role') = 'service_role';
  financial_fields_changed boolean :=
    new.unit_price_usd is distinct from old.unit_price_usd
    or new.logistics_usd is distinct from old.logistics_usd
    or new.escrow_fee_usd is distinct from old.escrow_fee_usd
    or new.total_amount is distinct from old.total_amount
    or new.receipt_reference is distinct from old.receipt_reference;
  status_changed boolean := new.escrow_status is distinct from old.escrow_status;
begin
  if is_service_role then
    return new;
  end if;

  if financial_fields_changed then
    raise exception 'orders: unit_price_usd, logistics_usd, escrow_fee_usd, total_amount, and receipt_reference can only be set by a verified payment event, not by a participant update';
  end if;

  if status_changed then
    -- The only two client-initiated lifecycle moves that don't represent
    -- money changing hands: farmer marks logistics arranged once escrow is
    -- already funded, buyer confirms delivery once logistics is done.
    -- 'Inquiry Sent' -> 'Escrow Funded' is deliberately absent — that
    -- transition only ever happens via a webhook's service_role update.
    if not (
      (old.escrow_status = 'Escrow Funded' and new.escrow_status = 'Logistics Scheduled' and auth.uid() = old.farmer_id)
      or (old.escrow_status = 'Logistics Scheduled' and new.escrow_status = 'Delivered & Released' and auth.uid() = old.buyer_id)
    ) then
      raise exception 'orders: % -> % is not a transition a participant can make directly', old.escrow_status, new.escrow_status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_guard_financial_writes on public.orders;
create trigger orders_guard_financial_writes
  before update on public.orders
  for each row execute function public.guard_order_financial_writes();

-- watchlist: private to the owning buyer
drop policy if exists "users manage their own watchlist" on public.watchlist;
create policy "users manage their own watchlist"
  on public.watchlist for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- transactions: read-only to the owning user; every row is written by the
-- Paystack webhook via the service role client, which bypasses RLS entirely,
-- so there's deliberately no insert/update/delete policy for regular users.
drop policy if exists "users can read their own transactions" on public.transactions;
create policy "users can read their own transactions"
  on public.transactions for select
  to authenticated
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Storage — real listing-photo files, replacing the base64 data-URLs
-- FarmerDashboard.tsx used to write straight into crop_listings.image_url.
-- Files live under "<farmer_id>/<filename>" so the folder-name check below
-- can enforce ownership without a second lookup table. Public bucket: photos
-- are meant to be visible on public listings, same as image_url already was.
-- ─────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

drop policy if exists "listing photos are publicly readable" on storage.objects;
create policy "listing photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

drop policy if exists "farmers can upload their own listing photos" on storage.objects;
create policy "farmers can upload their own listing photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "farmers can replace their own listing photos" on storage.objects;
create policy "farmers can replace their own listing photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "farmers can delete their own listing photos" on storage.objects;
create policy "farmers can delete their own listing photos"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────────────────────────────────
-- Realtime — stream inserts/updates to subscribed clients
--
-- MessagingContext subscribes to both `messages` and `conversations` (a new
-- conversation needs to push too, not just its messages), and
-- WatchlistContext subscribes to `watchlist` — all three must be in the
-- publication or those subscriptions silently receive nothing.
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
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
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

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'watchlist'
  ) then
    alter publication supabase_realtime add table public.watchlist;
  end if;
end $$;
