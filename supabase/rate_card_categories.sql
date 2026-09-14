-- =============================================================
-- EzMoney — sort his items into Work and Materials
--
-- rate_card_items.category defaults to 'Work', and learnRateCard never
-- set it, so every item he has ever typed onto a bill was filed as Work
-- — including two hundred wires, pipes and switches. That made the
-- Work/Materials split in the picker meaningless.
--
-- Two rules, in order:
--   1. The rates off his own printed price list are Work. Named exactly.
--   2. Anything whose name is about labour, service or a charge is Work.
--      Everything else is a thing he buys, so it is Material.
--
-- Safe to run twice; it only ever rewrites category.
-- =============================================================

-- 1. everything is a material unless it says otherwise
update public.rate_card_items set category = 'Material';

-- 2. the work he sells, by name, from his own price list
update public.rate_card_items set category = 'Work'
where description in (
  '2 Way fan point',
  '2 Way light point',
  'Antenna circuit per foot',
  'Antenna point',
  'Calling bell fitting',
  'Calling bell point',
  'Chandelier small fitting',
  'Exhaust Fan Fitting',
  'Fan fitting',
  'Fan point',
  'Fancy wall fitting',
  'GI pipe with UG cable per foot',
  'Grounding',
  'Heating circuit per foot',
  'Heating point',
  'Light point',
  'Lighting circuit per foot',
  'Main board DB box fixing',
  'Meter board fixing',
  'Pipe with UG cable per foot',
  'Plug point',
  'Potted',
  'Speaker circuit per foot',
  'Speaker point',
  'Telephone circuit per foot',
  'Telephone point',
  'Tube light fitting',
  'Underground cable per foot'
);

-- 3. anything he typed that is plainly labour rather than a thing
update public.rate_card_items set category = 'Work'
where description ~* '(labou?r|service|charges|wages|fitting charge|installation|instalation)';

-- Check: Materials should now far outnumber Work.
select category, count(*) as items from public.rate_card_items
group by category order by category;
