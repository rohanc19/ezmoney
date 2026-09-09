-- =============================================================
-- EzMoney v5
--   1. Part-payments. A bill is rarely paid in one go: an advance,
--      something on progress, the rest on completion. Payments are
--      the source of truth; documents.amount_received is derived
--      from them, the same way totals are derived from line items.
--   2. Backup coverage for everything added in v3 and v4.
-- Safe to run once on an existing v4 database.
-- =============================================================

-- ---------- money received against a bill ----------
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
create index if not exists payments_document_idx
  on public.payments (document_id, paid_on desc);
create index if not exists payments_user_idx
  on public.payments (user_id, paid_on desc);

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

-- ---------- what has actually come in, kept on the bill ----------
-- Derived from payments and written back, so a list of 200 bills does
-- not need 200 sub-queries. Recomputed by the app on every payment.
alter table public.documents
  add column if not exists amount_received numeric not null default 0;

-- ---------- a bill can now be part paid ----------
alter table public.documents drop constraint if exists documents_status_check;
alter table public.documents
  add constraint documents_status_check
  check (status in ('draft', 'sent', 'approved', 'rejected', 'paid', 'partly_paid'));

-- ---------- backfill ----------
-- Invoices already marked paid really were paid; without a payment row
-- they would all read as nothing received. Reconstruct one payment for
-- the full amount, dated the invoice itself, so the new ledger agrees
-- with what he already believes.
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
)
where d.amount_received = 0;

-- ---------- index the client lookups the ledger does ----------
create index if not exists documents_client_idx on public.documents (client_id);
create index if not exists expenses_client_idx on public.expenses (client_id);
