-- =============================================================
-- EzMoney — his six section templates, from his own notepad
--
-- Before a job he writes the materials for a section and hands the list
-- to a shop. Each section is a fixed set of items; only the quantities
-- change. These are transcribed from his handwritten pad.
--
-- Safe to run twice: a template is matched by name and its items are
-- replaced, so re-running refreshes rather than duplicating.
-- =============================================================

do $$
declare
  v_user uuid;
  v_list uuid;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'No user found. Create the login first, then re-run.';
  end if;

  -- ---------- Single phase T.P. Board ----------
  select id into v_list from public.checklists
   where user_id = v_user and is_template and name = 'Single phase T.P. Board';
  if v_list is null then
    insert into public.checklists (user_id, name, is_template)
    values (v_user, 'Single phase T.P. Board', true) returning id into v_list;
  end if;
  delete from public.checklist_items where checklist_id = v_list;
  insert into public.checklist_items (user_id, checklist_id, description, unit, position) values
    (v_user, v_list, '15/20 Wooden Board', 'Nos', 1),
    (v_user, v_list, '32 A Fuse Cutout', 'Nos', 2),
    (v_user, v_list, '4 Pole MCB Box', 'Nos', 3),
    (v_user, v_list, 'Double Pole 32 A MCB', 'Nos', 4),
    (v_user, v_list, '25 A ELCB', 'Nos', 5),
    (v_user, v_list, '3+2 Gang Box', 'Nos', 6),
    (v_user, v_list, 'Lisha Switch', 'Nos', 7),
    (v_user, v_list, 'Lisha Socket', 'Nos', 8),
    (v_user, v_list, '15 A S/S with Box', 'Nos', 9),
    (v_user, v_list, 'Tape Role', 'Nos', 10),
    (v_user, v_list, 'Angular Holder', 'Nos', 11),
    (v_user, v_list, '4 Sqmm Copper Wire', 'Mtr', 12),
    (v_user, v_list, '1 Sqmm Copper Wire', 'Mtr', 13);

  -- ---------- 3 phase T.P. Board ----------
  select id into v_list from public.checklists
   where user_id = v_user and is_template and name = '3 phase T.P. Board';
  if v_list is null then
    insert into public.checklists (user_id, name, is_template)
    values (v_user, '3 phase T.P. Board', true) returning id into v_list;
  end if;
  delete from public.checklist_items where checklist_id = v_list;
  insert into public.checklist_items (user_id, checklist_id, description, unit, position) values
    (v_user, v_list, '20/20 Wooden Board', 'Nos', 1),
    (v_user, v_list, '32 A Fuse Cutout', 'Nos', 2),
    (v_user, v_list, '4 Pole MCB Box', 'Nos', 3),
    (v_user, v_list, '32 A 4 Pole MCB', 'Nos', 4),
    (v_user, v_list, '25 A 4 Pole ELCB', 'Nos', 5),
    (v_user, v_list, '15 A S/S Double Socket Box', 'Nos', 6),
    (v_user, v_list, '3+2 Gang Box', 'Nos', 7),
    (v_user, v_list, 'Lisha Switch', 'Nos', 8),
    (v_user, v_list, 'Lisha Socket', 'Nos', 9),
    (v_user, v_list, '4 Sqmm Copper Wire', 'Mtr', 10),
    (v_user, v_list, '1 Sqmm Copper Wire', 'Mtr', 11),
    (v_user, v_list, 'Angular Holder', 'Nos', 12),
    (v_user, v_list, 'Tape Role', 'Nos', 13);

  -- ---------- Molding Material ----------
  select id into v_list from public.checklists
   where user_id = v_user and is_template and name = 'Molding Material';
  if v_list is null then
    insert into public.checklists (user_id, name, is_template)
    values (v_user, 'Molding Material', true) returning id into v_list;
  end if;
  delete from public.checklist_items where checklist_id = v_list;
  insert into public.checklist_items (user_id, checklist_id, description, unit, position) values
    (v_user, v_list, '1" VIP Pipe', 'Nos', 1),
    (v_user, v_list, '1" Bend', 'Nos', 2),
    (v_user, v_list, '1" Collar', 'Nos', 3),
    (v_user, v_list, '1" Closer', 'Nos', 4),
    (v_user, v_list, '3/4" VIP Pipe', 'Nos', 5),
    (v_user, v_list, '3/4" Bend', 'Nos', 6),
    (v_user, v_list, '3/4" Collar', 'Nos', 7),
    (v_user, v_list, '3/4" Closer', 'Nos', 8),
    (v_user, v_list, '100 ml Solution', 'Nos', 9),
    (v_user, v_list, 'Red Tape Role', 'Nos', 10),
    (v_user, v_list, 'Brown Tape', 'Nos', 11),
    (v_user, v_list, '1" Deep Junction Box', 'Nos', 12),
    (v_user, v_list, '3/4" Deep Junction Box', 'Nos', 13),
    (v_user, v_list, 'Fan Box', 'Nos', 14),
    (v_user, v_list, 'Spot Light Box', 'Nos', 15);

  -- ---------- Groove Cutting ----------
  select id into v_list from public.checklists
   where user_id = v_user and is_template and name = 'Groove Cutting';
  if v_list is null then
    insert into public.checklists (user_id, name, is_template)
    values (v_user, 'Groove Cutting', true) returning id into v_list;
  end if;
  delete from public.checklist_items where checklist_id = v_list;
  insert into public.checklist_items (user_id, checklist_id, description, unit, position) values
    (v_user, v_list, '3/4" Wall Pipe', 'Nos', 1),
    (v_user, v_list, '3/4" Bend', 'Nos', 2),
    (v_user, v_list, '3/4" Collar', 'Nos', 3),
    (v_user, v_list, '1" Wall Pipe', 'Nos', 4),
    (v_user, v_list, '1" Bend', 'Nos', 5),
    (v_user, v_list, '1" Collar', 'Nos', 6),
    (v_user, v_list, '1" Wall Junction Box', 'Nos', 7),
    (v_user, v_list, '3/4" Wall Junction Box', 'Nos', 8),
    (v_user, v_list, 'Tape Role', 'Nos', 9),
    (v_user, v_list, '2" SS Niles', 'Nos', 10),
    (v_user, v_list, '16 M Metal Box', 'Nos', 11),
    (v_user, v_list, '12 M Metal Box', 'Nos', 12),
    (v_user, v_list, '8 M Metal Box', 'Nos', 13),
    (v_user, v_list, '6 M Metal Box', 'Nos', 14),
    (v_user, v_list, '4 M Metal Box', 'Nos', 15),
    (v_user, v_list, '3 M Metal Box', 'Nos', 16),
    (v_user, v_list, '2 M Metal Box', 'Nos', 17),
    (v_user, v_list, 'Groove Cutting Blade', 'Nos', 18),
    (v_user, v_list, 'Metal Cutting Blade', 'Nos', 19),
    (v_user, v_list, 'Hexen Blade', 'Nos', 20);

  -- ---------- Wiring ----------
  select id into v_list from public.checklists
   where user_id = v_user and is_template and name = 'Wiring';
  if v_list is null then
    insert into public.checklists (user_id, name, is_template)
    values (v_user, 'Wiring', true) returning id into v_list;
  end if;
  delete from public.checklist_items where checklist_id = v_list;
  insert into public.checklist_items (user_id, checklist_id, description, unit, position) values
    (v_user, v_list, '6 Sqmm Copper Wire', 'Mtr', 1),
    (v_user, v_list, '4 Sqmm Copper Wire', 'Mtr', 2),
    (v_user, v_list, '2.5 Sqmm Copper Wire', 'Mtr', 3),
    (v_user, v_list, '1.5 Sqmm Copper Wire', 'Mtr', 4),
    (v_user, v_list, '1 Sqmm Copper Wire', 'Mtr', 5),
    (v_user, v_list, 'Antenna Wire', 'Mtr', 6),
    (v_user, v_list, 'Telephone Wire', 'Mtr', 7),
    (v_user, v_list, 'Cat 6 Wire', 'Mtr', 8),
    (v_user, v_list, 'Auto Level Control Wire 4 Core', 'Mtr', 9),
    (v_user, v_list, 'Speaker Wire', 'Mtr', 10),
    (v_user, v_list, 'Tape Role', 'Nos', 11);

  -- ---------- Switch Board ----------
  select id into v_list from public.checklists
   where user_id = v_user and is_template and name = 'Switch Board';
  if v_list is null then
    insert into public.checklists (user_id, name, is_template)
    values (v_user, 'Switch Board', true) returning id into v_list;
  end if;
  delete from public.checklist_items where checklist_id = v_list;
  insert into public.checklist_items (user_id, checklist_id, description, unit, position) values
    (v_user, v_list, '16 M Plate', 'Nos', 1),
    (v_user, v_list, '12 M Plate', 'Nos', 2),
    (v_user, v_list, '8 M Plate', 'Nos', 3),
    (v_user, v_list, '6 M Plate', 'Nos', 4),
    (v_user, v_list, '4 M Plate', 'Nos', 5),
    (v_user, v_list, '3 M Plate', 'Nos', 6),
    (v_user, v_list, '2 M Plate', 'Nos', 7),
    (v_user, v_list, '1 M Plate', 'Nos', 8);

end $$;

-- Check: six sections and how many items each carries.
select c.name, count(i.id) as items
from public.checklists c
left join public.checklist_items i on i.checklist_id = c.id
where c.is_template
group by c.name order by c.name;
