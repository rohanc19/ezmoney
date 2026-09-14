-- =============================================================
-- EzMoney — "Role" is a part in a play; this is a roll of pipe
--
-- The unit was spelled Role for two years and prints on the customer's
-- copy ("3 Role"). Three saved items use it — 1/2", 3/4" and 5" flexible
-- pipe — plus any bill line that was made from them.
--
-- The old spelling stays in the app's unit list either way, so it does
-- not matter whether this is run before or after the code goes out:
-- nothing ever renders a blank unit.
--
-- Safe to run twice: the second run changes nothing.
-- =============================================================

-- Look first.
select 'rate_card_items' as source, description, unit
  from public.rate_card_items where unit = 'Role'
union all
select 'line_items', description, unit
  from public.line_items where unit = 'Role'
 order by 1, 2;

update public.rate_card_items set unit = 'Roll' where unit = 'Role';
update public.line_items      set unit = 'Roll' where unit = 'Role';

-- Check: both must be 0.
select
  (select count(*) from public.rate_card_items where unit = 'Role') as rate_card_left,
  (select count(*) from public.line_items      where unit = 'Role') as line_items_left;
