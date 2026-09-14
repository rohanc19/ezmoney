-- =============================================================
-- EzMoney — the fields his real tax invoice carries
--
-- His printed bill is modelled on the GST tax invoice his accountant
-- already issues: a due date on the bill, the customer's PAN beside
-- their GSTIN, the bank branch under the account number, and a block
-- of standing terms at the foot.
--
-- Every one of these is optional. A bill with none of them filled in
-- prints exactly as it did before — the row simply does not appear.
-- Safe to run twice.
-- =============================================================

alter table public.documents
  add column if not exists due_date date;

alter table public.clients
  add column if not exists pan text not null default '';

alter table public.business_profile
  add column if not exists bank_branch text not null default '',
  add column if not exists terms text not null default '';

-- His accountant's standing wording, so the box is not empty on day one.
-- Only fills a profile that has never had terms set.
update public.business_profile
   set terms = 'Subject to our home Jurisdiction.
Our Responsibility Ceases as soon as goods leaves our Premises.
Goods once sold will not taken back.
Delivery Ex-Premises.'
 where coalesce(terms, '') = '';

-- Check: all four must print "yes".
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='documents' and column_name='due_date') = 1 as documents_due_date,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='clients' and column_name='pan') = 1 as clients_pan,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='business_profile' and column_name='bank_branch') = 1 as profile_bank_branch,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='business_profile' and column_name='terms') = 1 as profile_terms;
