-- =============================================================
-- EzMoney — the two blocks he retypes, and one unit that was wrong
--
-- His 2022 sheets carry an Earthing section and a power-supply deposit
-- block that recur across jobs and are in neither the shop lists nor the
-- rate card, so he writes them out every time.
--
-- Earthing is materials, so it becomes a shop-list template. The deposit
-- block is not bought at a shop — it is BESCOM's charges — so it goes in
-- the rate card, where it can be tapped onto a bill. The figures are the
-- 2022 ones for a single-phase supply; they change with the sanctioned
-- load, so treat them as a starting point he edits.
--
-- Safe to run twice.
-- =============================================================

do $$
declare
  v_user uuid;
  v_list uuid;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'No user found.'; end if;

  -- ---------- Earthing, as a shop list ----------
  select id into v_list from public.checklists
   where user_id = v_user and is_template and name = 'Earthing';
  if v_list is null then
    insert into public.checklists (user_id, name, is_template)
    values (v_user, 'Earthing', true) returning id into v_list;
  end if;
  delete from public.checklist_items where checklist_id = v_list;
  insert into public.checklist_items (user_id, checklist_id, description, unit, position) values
    (v_user, v_list, '4 Feet GI Pipe With Hole', 'Nos', 1),
    (v_user, v_list, 'Brass Bolt & Nut', 'Nos', 2),
    (v_user, v_list, '1 Feet/1 Feet Copper Plate', 'Nos', 3),
    (v_user, v_list, 'Copper 8 Gauge Wire', 'Kg', 4),
    (v_user, v_list, 'Charcoal Big Bag', 'Bag', 5),
    (v_user, v_list, 'Salt', 'Kg', 6),
    (v_user, v_list, 'Tube Level Pipe', 'Mtr', 7);

  -- ---------- BESCOM's charges, as rate card items ----------
  insert into public.rate_card_items (user_id, description, unit, rate, category)
  values
    (v_user, 'Meter Cost (Refundable)', 'Nos', 8000, 'Work'),
    (v_user, 'BESCOM Deposit',          'Nos', 8000, 'Work'),
    (v_user, 'Paper Charges',           'Nos',  500, 'Work'),
    (v_user, 'Office Expense',          'Nos', 3500, 'Work'),
    (v_user, 'Contractor Charges',      'Nos', 1500, 'Work')
  on conflict (user_id, description) do nothing;
end $$;

-- ---------- the unit that was wrong ----------
-- Every sheet buys niles by weight: 0.25 Kg, 0.5 Kg, 1 Kg, all at ₹200.
-- The rate card said ₹200 each, which prints "Nos" on a customer's bill
-- for something sold by the kilo — and bills two of them as ₹400 when a
-- kilo is ₹200.
update public.rate_card_items
   set unit = 'Kg'
 where description in ('2 inch SS niles', '2inch SS niles')
   and unit <> 'Kg';

-- Check: Earthing has 7 items, the five charges exist, niles are in Kg.
select
  (select count(*) from public.checklist_items i
     join public.checklists c on c.id = i.checklist_id
    where c.is_template and c.name = 'Earthing') as earthing_items,
  (select count(*) from public.rate_card_items
    where description in ('Meter Cost (Refundable)','BESCOM Deposit','Paper Charges',
                          'Office Expense','Contractor Charges')) as bescom_items,
  (select count(*) from public.rate_card_items
    where description ilike '%niles%' and unit = 'Kg') as niles_in_kg;
