-- =============================================================
-- EzMoney — the four rows in My Items & Rates that are not items
--
-- Two are keyboard tests. Two are text that bled out of a scanned PDF
-- and became a description, carrying another row's figures with it.
--
-- Deliberately narrow. Everything else in that list stays, including
-- the ones that look odd and are not: Charcoal (Rs 450/Bag) and Salt
-- (Rs 18/Kg) are earthing materials, and Gatta, Potted and Checkey are
-- his trade's words with sensible rates against them.
--
-- Each row is matched in full, so this cannot take anything else.
-- Safe to run twice: the second run deletes nothing.
-- =============================================================

-- Look first. These four, and nothing else, should come back.
select description, unit, rate, times_used
  from public.rate_card_items
 where description in (
   'gythgjmn',
   'kukjjh',
   '3/4" C Clamp Double Nile 6 400 432.00 2592.00 7 Gatta',
   'Lathe Work 600.00 600.00 5 2.5" Bolt/ Washer'
 )
 order by description;

-- Then remove them.
delete from public.rate_card_items
 where description in (
   'gythgjmn',
   'kukjjh',
   '3/4" C Clamp Double Nile 6 400 432.00 2592.00 7 Gatta',
   'Lathe Work 600.00 600.00 5 2.5" Bolt/ Washer'
 );

-- Check: 210 left, from 214.
select count(*) as items_left from public.rate_card_items;
