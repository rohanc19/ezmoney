-- =============================================================
-- EzMoney — parts of a job
--
-- His big estimates are not one flat list. The Anjanapura Godan job
-- (₹2,00,333) is four named parts, each with its own items, its own
-- labour line and its own subtotal, and he writes a separate summary
-- sheet listing just those four figures:
--
--   Internal Wiring     1,14,663
--   Underground Cable      29,440
--   Meter Panal            28,130
--   BESCOM Charges         28,100
--   TOTAL               2,00,333
--
-- An empty section means the bill is a plain list, which is what most
-- of his cash bills are — so this changes nothing for them.
-- Safe to run once on an existing database.
-- =============================================================

alter table public.line_items
  add column if not exists section text not null default '';

-- The print view reads a document's lines grouped by part, in order.
create index if not exists line_items_section_idx
  on public.line_items (document_id, section, position);
