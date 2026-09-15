-- =============================================================
-- EzMoney — shop prices, kept by recording the day
--
-- The price book used to be a screen he had to feed by hand, which meant
-- it held five prices across four shops and could answer nothing. He
-- already writes down what he spent each evening, so the prices come
-- from that instead: pick the shop, say how many, and the unit price is
-- arithmetic.
--
-- `qty` and `unit` make an expense a purchase rather than a figure, and
-- `shop_id` is who he bought it from — a real reference, not the free
-- text `vendor` held, so a shop renamed stays joined up.
--
-- Safe to run twice.
-- =============================================================

alter table public.expenses
  add column if not exists shop_id uuid references public.shops (id) on delete set null,
  add column if not exists qty numeric not null default 0,
  add column if not exists unit text not null default '';

create index if not exists expenses_shop_idx on public.expenses (user_id, shop_id, date desc);

-- Prices now also arrive from the day book, so the provenance list grows.
alter table public.item_prices drop constraint if exists item_prices_source_check;
alter table public.item_prices
  add constraint item_prices_source_check check (source in ('manual', 'scan', 'day'));

-- He buys from his regular shops and, now and then, a small one he will
-- not remember the name of. "Other" is that sixth option, so those prices
-- are still recorded rather than lost for want of a name.
insert into public.shops (user_id, name, area, phone, address, notes)
select u.id, 'Other', '', '', '', ''
  from auth.users u
 where not exists (
   select 1 from public.shops s where s.user_id = u.id and lower(s.name) = 'other'
 );

-- Check: all four must print "yes".
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='expenses' and column_name='shop_id') = 1 as expense_shop,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='expenses' and column_name='qty') = 1 as expense_qty,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='expenses' and column_name='unit') = 1 as expense_unit,
  (select count(*) from pg_constraint
    where conname = 'item_prices_source_check') = 1 as source_check;
