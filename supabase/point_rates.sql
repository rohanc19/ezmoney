-- =============================================================
-- EzMoney — mark the point rates as points
--
-- His whole-house jobs are priced per point: so many light points, so
-- many plug points, so many feet of lighting circuit. The 2017 and 2020
-- sheets are exactly that, and the 25 rates are already in his list —
-- scattered through 273 items with nothing to tell them apart, which is
-- why he has not priced a job that way since.
--
-- `category` is a plain text column (Work | Material by convention), so
-- "Point" simply joins it. Every one of these is matched in full.
--
-- Safe to run twice.
-- =============================================================

update public.rate_card_items
   set category = 'Point'
 where description in (
   'Light point',
   'Plug point',
   'Fan point',
   '2 Way fan point',
   '2 Way light point',
   'Heating point',
   'Calling bell point',
   'Antenna point',
   'Speaker point',
   'Telephone point',
   'Lighting circuit per foot',
   'Heating circuit per foot',
   'Antenna circuit per foot',
   'Speaker circuit per foot',
   'Telephone circuit per foot',
   'Pipe with UG cable per foot',
   'GI pipe with UG cable per foot',
   'Underground cable per foot',
   'Grounding',
   'Potted',
   '25 Sqmm Potted',
   'Meter board fixing',
   'Main board DB box fixing',
   '12 Way DB Box',
   'U P S  Mass Pet Circuit Board'
 );

-- Check: 25, and what they are.
select count(*) as point_rates from public.rate_card_items where category = 'Point';
select description, unit, rate from public.rate_card_items
 where category = 'Point' order by rate desc;
