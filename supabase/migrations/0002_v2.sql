-- =============================================================
-- EzMoney v2
--   1. Full GST tax invoice (HSN/SAC, CGST/SGST/IGST, place of supply)
--   2. Rate card (saved items with default rates)
--   3. Receipt photos on expenses
--   4. Client state (decides intrastate vs interstate tax)
-- Safe to run once on an existing v1 database.
-- =============================================================

-- ---------- business profile: seller's state + defaults ----------
alter table public.business_profile
  add column if not exists state_code text not null default '29',      -- 29 = Karnataka
  add column if not exists state_name text not null default 'Karnataka',
  add column if not exists default_hsn_sac text not null default '',   -- e.g. 995461 (electrical installation)
  add column if not exists invoice_footer_note text not null default '';

-- ---------- clients: their state + GSTIN (for B2B invoices) ----------
alter table public.clients
  add column if not exists state_code text not null default '',
  add column if not exists state_name text not null default '',
  add column if not exists gstin text;

-- ---------- documents: tax split + place of supply ----------
alter table public.documents
  add column if not exists cgst_amount numeric not null default 0,
  add column if not exists sgst_amount numeric not null default 0,
  add column if not exists igst_amount numeric not null default 0,
  add column if not exists place_of_supply text not null default '',
  add column if not exists taxable_value numeric not null default 0;

-- ---------- line items: HSN/SAC + per-line GST rate ----------
alter table public.line_items
  add column if not exists hsn_sac text not null default '',
  add column if not exists gst_rate numeric not null default 0;

-- ---------- rate card ----------
-- His saved items: "Point wiring — ₹260 per Point". Picking from this
-- list is the fastest way to build a bill.
create table if not exists public.rate_card_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  description text not null,
  unit text not null default 'Nos',
  rate numeric not null default 0,
  hsn_sac text not null default '',
  category text not null default 'Work',        -- Work | Material
  times_used int not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, description)
);
create index if not exists rate_card_user_idx
  on public.rate_card_items (user_id, times_used desc);

alter table public.rate_card_items enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'rate_card_items' and policyname = 'own rate card'
  ) then
    create policy "own rate card" on public.rate_card_items
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ---------- expenses: receipt photo ----------
alter table public.expenses
  add column if not exists receipt_path text;

-- =============================================================
-- Storage: private bucket for receipt photos.
-- Files are stored as <user_id>/<expense-id>-<timestamp>.jpg and are
-- only readable by their owner (served through short-lived signed URLs).
-- =============================================================
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'own receipts read'
  ) then
    create policy "own receipts read" on storage.objects
      for select using (
        bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'own receipts write'
  ) then
    create policy "own receipts write" on storage.objects
      for insert with check (
        bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'own receipts delete'
  ) then
    create policy "own receipts delete" on storage.objects
      for delete using (
        bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
      );
  end if;
end $$;

-- ---------- backfill: give existing line items the profile's GST rate ----------
update public.line_items li
set gst_rate = coalesce((
  select bp.gst_rate from public.business_profile bp where bp.user_id = li.user_id
), 0.18)
where li.gst_rate = 0;

-- ---------- backfill: taxable value on existing documents ----------
update public.documents
set taxable_value = subtotal
where taxable_value = 0;
