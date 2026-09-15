-- =============================================================
-- EzMoney — one Gopinath, not two
--
-- "Gopinath relation" and "Gopinath Relation" are the same customer,
-- entered twice with a different capital R, so his history is split
-- across two records and neither shows the whole picture.
--
-- The lower-case one is kept: it carries the address and the real
-- invoice history (INV-2026-013, EST-2026-002). The capital-R one holds
-- only EST-2026-003, which moves across.
--
-- Four tables point at a client. All four are moved before the empty
-- record is deleted, so nothing is orphaned — and because every one of
-- them is "on delete set null", deleting first would have silently cut
-- that estimate loose instead of failing.
--
-- Safe to run twice: the second run finds nothing to move.
-- =============================================================

-- 1. Look first. This is everything that is about to move.
select 'documents' as what, serial_no as ref, doc_date as on_date, total
  from public.documents
 where client_id = (select id from public.clients where name = 'Gopinath Relation')
union all
select 'expenses', item, date, amount
  from public.expenses
 where client_id = (select id from public.clients where name = 'Gopinath Relation')
union all
select 'labour', site_job, entry_date, amount
  from public.worker_entries
 where client_id = (select id from public.clients where name = 'Gopinath Relation')
union all
select 'shop lists', name, list_date, 0
  from public.checklists
 where client_id = (select id from public.clients where name = 'Gopinath Relation');

-- 2. Move it all onto the record that is being kept.
do $$
declare
  v_keep uuid;
  v_drop uuid;
begin
  select id into v_keep from public.clients where name = 'Gopinath relation';
  select id into v_drop from public.clients where name = 'Gopinath Relation';

  if v_keep is null or v_drop is null then
    raise notice 'Nothing to merge — one of the two names was not found.';
    return;
  end if;

  update public.documents      set client_id = v_keep where client_id = v_drop;
  update public.expenses       set client_id = v_keep where client_id = v_drop;
  update public.worker_entries set client_id = v_keep where client_id = v_drop;
  update public.checklists     set client_id = v_keep where client_id = v_drop;

  delete from public.clients where id = v_drop;
end $$;

-- 3. Check: one Gopinath left, and his bills all present.
select c.name, count(d.id) as bills, coalesce(sum(d.total), 0) as total
  from public.clients c
  left join public.documents d on d.client_id = c.id
 where c.name ilike 'gopinath%'
 group by c.name;
