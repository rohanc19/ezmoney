-- =============================================================
-- EzMoney — job costing
--
-- Margin per job reads the expenses tagged to a client and the days
-- worked on that client's sites, so both want an index by client.
--
-- An earlier version of this file also added `checklist_items.rate`,
-- `checklists.shop_id` and `checklists.expense_id`, for pricing up a shop
-- list. That was the wrong end of his day: he writes the list BEFORE
-- going to the shop, as a checklist, and asking him to come back and
-- price it afterwards is exactly the data entry that never gets done.
-- Material cost is recorded on the Today page instead, where he is
-- already sitting with the receipts. If you ran that version, nothing
-- needs undoing — three unused columns, all defaulted, harmless.
--
-- Safe to run twice.
-- =============================================================

create index if not exists expenses_client_idx on public.expenses (user_id, client_id);
create index if not exists worker_entries_client_idx on public.worker_entries (user_id, client_id);

-- Check: both must print "yes".
select
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'expenses_client_idx') = 1 as expenses_idx,
  (select count(*) from pg_indexes
    where schemaname = 'public' and indexname = 'worker_entries_client_idx') = 1 as labour_idx;
