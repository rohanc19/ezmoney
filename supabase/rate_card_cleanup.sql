-- =============================================================
-- EzMoney — remove the mangled rows from the first rate-card seed
--
-- The first seed carried fifteen descriptions that were PDF bleed
-- rather than item names. The corrected seed added the proper names
-- alongside them rather than replacing them, because the upsert keys
-- on the description. These fifteen are the leftovers.
--
-- Deletes by exact description, so it can only ever hit these rows.
-- Safe to run twice.
-- =============================================================

delete from public.rate_card_items
where description in (
  '00 114663.00 114663 . 00 UG Cable 34 25 Sqmm UG cable',
  'CASH BILL 7 20 A Roma 2x1 Socket',
  'Checkey 20 No 10 . 00 200 . 00 31 Round Block',
  'dl 24 2 Module PVC Box',
  'e Date:26/7/2024 Sub : Electrical Wor k 1 3/4 " PVC Pipe',
  'e t Li g ht Fitti ng 1 No 3500 . 00 3500 . 00 4 Bend Rod',
  'Electrical Wor k Estimation UG Cable 1 25 Sqmm UG cable',
  'Estimation 4 end 5 o 0.00 600.00 5 3/4" Collar',
  'Gt t 500 N 20 0 1000 00 11 Gatta',
  'harges 5500.00 5500.00 36443.00 Earthing 1 4Feet GI Pipe',
  'harges 5500.00 5500.00 38393.00 Earthing 1 4Feet GI Pipe',
  'ontractor and Supervisor Internal Wiring 1 3/4" PVC Pipe',
  'Supervisor S u b : El ec t r i ca l W or k 1 LED Driver',
  'Ta p e Role',
  'Tape Role 15 No 25 . 00 375 . 00 18 12 Module PVC Box'
);

-- Check: 0 rows left matching, and the healthy list remains.
select count(*) filter (where description in ('00 114663.00 114663 . 00 UG Cable 34 25 Sqmm UG cable',
  'CASH BILL 7 20 A Roma 2x1 Socket',
  'Checkey 20 No 10 . 00 200 . 00 31 Round Block',
  'dl 24 2 Module PVC Box',
  'e Date:26/7/2024 Sub : Electrical Wor k 1 3/4 " PVC Pipe',
  'e t Li g ht Fitti ng 1 No 3500 . 00 3500 . 00 4 Bend Rod',
  'Electrical Wor k Estimation UG Cable 1 25 Sqmm UG cable',
  'Estimation 4 end 5 o 0.00 600.00 5 3/4" Collar',
  'Gt t 500 N 20 0 1000 00 11 Gatta',
  'harges 5500.00 5500.00 36443.00 Earthing 1 4Feet GI Pipe',
  'harges 5500.00 5500.00 38393.00 Earthing 1 4Feet GI Pipe',
  'ontractor and Supervisor Internal Wiring 1 3/4" PVC Pipe',
  'Supervisor S u b : El ec t r i ca l W or k 1 LED Driver',
  'Ta p e Role',
  'Tape Role 15 No 25 . 00 375 . 00 18 12 Module PVC Box')) as junk_left,
       count(*) as items_total
from public.rate_card_items;
