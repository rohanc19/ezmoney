-- =============================================================
-- EzMoney — billing what he actually bought
--
-- He records the day's shop runs against a client on /day, and then, when
-- the bill comes, reads back through them and types it all again. This
-- lets the bill pull those lines in with a markup on cost.
--
-- `billed_document_id` is which bill an expense went onto. It is how the
-- picker knows not to offer the same purchase twice on the next bill for
-- a long job — the thing that makes this safe rather than merely quick.
--
-- On delete set null, so deleting a bill frees its materials to be billed
-- again rather than stranding them.
--
-- Safe to run twice.
-- =============================================================

alter table public.expenses
  add column if not exists billed_document_id uuid
    references public.documents (id) on delete set null;

create index if not exists expenses_unbilled_idx
  on public.expenses (user_id, client_id, billed_document_id);

-- Check: must print "yes".
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='expenses'
      and column_name='billed_document_id') = 1 as expense_billed_link;
