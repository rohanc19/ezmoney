-- =============================================================
-- EzMoney — what the materials actually cost
--
-- He writes a shop list for each section of work, hands it over, and gets
-- an invoice back. The app knew what he asked for and never what he paid,
-- so every job's biggest cost was invisible and "profit" on the Summary
-- was revenue minus labour — about three times too flattering.
--
-- `rate` is what the shop charged per unit. `shop_id` is who charged it.
-- `expense_id` is the one expense row the list produced, kept so that
-- re-recording a list corrects that row instead of adding a second.
--
-- All optional. A list with no prices behaves exactly as it did.
-- Safe to run twice.
-- =============================================================

alter table public.checklist_items
  add column if not exists rate numeric not null default 0;

alter table public.checklists
  add column if not exists shop_id uuid references public.shops (id) on delete set null,
  add column if not exists expense_id uuid references public.expenses (id) on delete set null;

-- Job costing reads expenses by client, and the labour book by client.
create index if not exists expenses_client_idx on public.expenses (user_id, client_id);
create index if not exists worker_entries_client_idx on public.worker_entries (user_id, client_id);

-- Check: all three must print "yes".
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='checklist_items' and column_name='rate') = 1 as item_rate,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='checklists' and column_name='shop_id') = 1 as list_shop,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='checklists' and column_name='expense_id') = 1 as list_expense;
