-- =============================================================
-- EzMoney — catch-up
--
-- 0005 did not fully apply on the live database once, and a half-applied
-- migration is worse than none: the payments table existed while
-- documents.amount_received did not, so every money query errored and
-- Home quietly showed zero.
--
-- This brings the database to the state the app expects no matter how
-- much of 0003–0005 landed. Every statement is safe to run repeatedly.
-- Run it whenever anything looks wrong, then run the check at the bottom.
-- =============================================================

-- ---------- 0005: part-payments ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  paid_on date not null default current_date,
  amount numeric not null default 0,
  method text not null default 'Cash'
    check (method in ('Cash', 'UPI', 'Card', 'Bank', 'Credit')),
  notes text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists payments_document_idx on public.payments (document_id, paid_on desc);
create index if not exists payments_user_idx on public.payments (user_id, paid_on desc);

alter table public.payments enable row level security;
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'payments' and policyname = 'own payments'
  ) then
    create policy "own payments" on public.payments
      for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
  end if;
end $$;

-- The column whose absence broke Home, the clients list and every ledger.
alter table public.documents
  add column if not exists amount_received numeric not null default 0;

alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents
  add constraint documents_status_check
  check (status in ('draft', 'sent', 'approved', 'rejected', 'paid', 'partly_paid'));

-- ---------- 0003 / 0004, in case either was also partial ----------
alter table public.documents
  add column if not exists service_charge_mode text not null default 'none',
  add column if not exists service_charge_value numeric not null default 0,
  add column if not exists service_charge_amount numeric not null default 0,
  add column if not exists service_charge_label text not null default 'Service Charge';

alter table public.business_profile
  add column if not exists default_service_charge_percent numeric not null default 0,
  add column if not exists service_charge_label text not null default 'Service Charge';

-- ---------- indexes the ledgers rely on ----------
create index if not exists documents_client_idx on public.documents (client_id);
create index if not exists expenses_client_idx on public.expenses (client_id);

-- ---------- backfill, only where it has not already happened ----------
insert into public.payments (user_id, document_id, paid_on, amount, method, notes)
select d.user_id, d.id, d.doc_date, d.total, 'Cash',
       'Recorded automatically when part-payments were added'
from public.documents d
where d.type = 'invoice'
  and d.status = 'paid'
  and d.total > 0
  and not exists (select 1 from public.payments p where p.document_id = d.id);

update public.documents d
set amount_received = coalesce(
  (select sum(p.amount) from public.payments p where p.document_id = d.id), 0
);

-- ---------- the check ----------
-- Every row must read "yes". Anything else means something above failed.
select
  case when exists (select 1 from information_schema.columns
    where table_name = 'documents' and column_name = 'amount_received')
    then 'yes' else 'NO' end                                   as documents_amount_received,
  case when exists (select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'payments')
    then 'yes' else 'NO' end                                   as payments_table,
  case when exists (select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'workers')
    then 'yes' else 'NO' end                                   as workers_table,
  case when exists (select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'item_prices')
    then 'yes' else 'NO' end                                   as item_prices_table,
  case when exists (select 1 from information_schema.columns
    where table_name = 'documents' and column_name = 'service_charge_amount')
    then 'yes' else 'NO' end                                   as service_charge_columns;
