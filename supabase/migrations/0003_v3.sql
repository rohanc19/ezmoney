-- =============================================================
-- EzMoney v3
--   1. Labour book — the people he hires, person by person, with
--      every work day and every payment kept against that person.
--   2. Service charge on an estimate / invoice.
-- Safe to run once on an existing v2 database.
-- =============================================================

-- ---------- the people he hires ----------
create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  phone text not null default '',
  -- What they do on site. Plain words, not job titles.
  skill text not null default 'Helper',
  -- His usual wage for this person. Fills the work form so a day's
  -- entry is two taps.
  daily_rate numeric not null default 0,
  address text not null default '',
  notes text not null default '',
  -- Someone who has stopped working for him: kept for the record,
  -- hidden from the top of the list.
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists workers_user_idx on public.workers (user_id, active, name);

-- ---------- every rupee, against the person it belongs to ----------
-- kind = 'work'    → what he owes them (days x rate, or a lump sum)
-- kind = 'payment' → money handed over
-- kind = 'advance' → money handed over before the work
-- Balance for a worker = sum(work) - sum(payment + advance).
-- amount is always the rupee figure, so the balance is one sum either way.
create table if not exists public.worker_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  worker_id uuid not null references public.workers (id) on delete cascade,
  entry_date date not null default current_date,
  kind text not null default 'work' check (kind in ('work', 'payment', 'advance')),
  -- work rows
  days numeric not null default 0,
  rate numeric not null default 0,
  site_job text not null default '',
  client_id uuid references public.clients (id) on delete set null,
  -- payment rows
  paid_via text not null default 'Cash'
    check (paid_via in ('Cash', 'UPI', 'Card', 'Bank', 'Credit')),
  amount numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists worker_entries_worker_idx
  on public.worker_entries (worker_id, entry_date desc);
create index if not exists worker_entries_user_idx
  on public.worker_entries (user_id, entry_date desc);

alter table public.workers enable row level security;
alter table public.worker_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'workers' and policyname = 'own workers'
  ) then
    create policy "own workers" on public.workers
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'worker_entries' and policyname = 'own worker entries'
  ) then
    create policy "own worker entries" on public.worker_entries
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- ---------- service charge on a bill ----------
-- His fee for the job, on top of the items. Either a percentage of the
-- items or a flat rupee figure. The rupee figure is always stored in
-- service_charge_amount, so nothing downstream has to do the arithmetic.
alter table public.documents
  add column if not exists service_charge_mode text not null default 'none',
  add column if not exists service_charge_value numeric not null default 0,
  add column if not exists service_charge_amount numeric not null default 0,
  add column if not exists service_charge_label text not null default 'Service Charge';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'documents_service_charge_mode_check'
  ) then
    alter table public.documents
      add constraint documents_service_charge_mode_check
      check (service_charge_mode in ('none', 'percent', 'amount'));
  end if;
end $$;

-- His usual service charge, so he does not retype it on every bill.
alter table public.business_profile
  add column if not exists default_service_charge_percent numeric not null default 0,
  add column if not exists service_charge_label text not null default 'Service Charge';
