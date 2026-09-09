-- =============================================================
-- EzMoney v4 — the shop price book
--   Which shop sells which material at what price, and when he
--   last saw that price. Answers "where do I buy this today".
-- Safe to run once on an existing v3 database.
-- =============================================================

-- ---------- the shops he buys from ----------
-- `area` is the locality (SP Road, Peenya, Jalahalli). It is how he
-- weighs a cheaper price against a longer trip — he knows Bangalore
-- better than a routing engine would, so no map is involved.
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  area text not null default '',
  phone text not null default '',
  address text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists shops_user_idx on public.shops (user_id, name);

-- ---------- a price, seen on a day, at a shop ----------
-- Every row is dated. A price book that shows a stale figure
-- confidently is worse than no price book, so nothing here is ever
-- overwritten: new sightings are appended and the newest one wins.
--   item      — as written on the bill, for him to read
--   item_key  — normalised, for matching the same thing across shops
create table if not exists public.item_prices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  item text not null,
  item_key text not null,
  unit text not null default 'Nos',
  rate numeric not null default 0,
  seen_on date not null default current_date,
  source text not null default 'manual' check (source in ('manual', 'scan')),
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists item_prices_lookup_idx
  on public.item_prices (user_id, item_key, seen_on desc);
create index if not exists item_prices_shop_idx
  on public.item_prices (shop_id, seen_on desc);

alter table public.shops enable row level security;
alter table public.item_prices enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'shops' and policyname = 'own shops'
  ) then
    create policy "own shops" on public.shops
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'item_prices' and policyname = 'own item prices'
  ) then
    create policy "own item prices" on public.item_prices
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;
