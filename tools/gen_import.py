# -*- coding: utf-8 -*-
import sys, re
sys.path.insert(0, "/private/tmp/claude-501/-Users-rohan-Projects-ezmoney/bb90915c-498e-4fdc-b22b-660129b0599f/scratchpad")
from xlsx import sheet

BASE = "/Users/rohan/Library/Containers/net.whatsapp.WhatsApp/Data/tmp/documents/"

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

def num(s):
    if s is None: return None
    t = str(s).strip().replace(",", "")
    try: return float(t)
    except ValueError: return None

SPECS = [
    dict(file="20F7CFA1-1758-4A72-8141-DD9F00B8DDC8/Ramesh Eng Uttarahalli.xlsx",
         client="Ramesh Eng Uttarahalli", date="2019-10-15", type="invoice",
         serial="INV-2019-001", job="Electrical work — Uttarahalli", off=1,
         sections=[("Kitchen Groove Cutting", 11, 22), ("Ground Floor Bath Room", 26, 32),
                   ("First Floor Molding", 36, 51), ("Kitchen Plate", 55, 73),
                   ("First Floor Groove Cutting", 77, 94)]),
    dict(file="53645080-E1A1-4BF9-884D-9093A045A01C/New Microsoft Office Excel Worksheet (3).xlsx",
         client="Mr Vardhaman", date="2020-06-25", type="invoice",
         serial="INV-2020-001", job="Electrical work", off=0,
         discount=[("Less 10%", 0.10)],
         sections=[("Wiring", 12, 46), ("Fitting", 48, 54), ("Extra", 57, 64)]),
    dict(file="E5BD9F42-C25B-4D14-ADA8-3925564F51E2/Chandramouly.xlsx",
         client="Chandramouly", date="2022-02-27", type="invoice",
         serial="INV-2022-001", job="Single phase T.P. board", off=0,
         sections=[("Single Phase T.P. Board", 5, 21), ("Power Supply Deposit", 26, 30)]),
    dict(file="765EB4C1-710B-4459-A751-5FAA4E6D3C3A/Kumar Sudrashen.xlsx",
         client="Kumar Sudrashen", date="2022-10-22", type="invoice",
         serial="INV-2022-002", job="Single phase T.P. board material", off=0,
         sections=[("", 35, 51)]),
    dict(file="FAD1ED2D-3A04-44D7-8102-3FDB9DC6646C/Prasana jayaram.xlsx",
         client="Prasana Jayaram", date="2017-04-02", type="estimate",
         serial="EST-2017-001", job="Electrical estimation / quotation", off=0,
         sections=[("", 11, 43)]),
]

def rows_for(grid, off, lo, hi):
    out = []
    for r in range(lo, hi + 1):
        g = lambda c: grid.get((r, c + off))
        desc = g(1)
        if not desc: continue
        if re.match(r"^\d+(\.\d+)?$", desc.replace(",", "")): continue
        qty, unit, rate, amt = num(g(2)), g(3), num(g(4)), num(g(5))
        if qty is None and rate is None and amt is None:
            # a lump line: the figure sits further right
            for c in (4, 5, 6):
                v = num(g(c))
                if v: amt = v; break
            if amt is None: continue
            qty, unit, rate = 1.0, "Lump", amt
        if amt is None and qty is not None and rate is not None:
            amt = qty * rate
        if amt is None and qty is None and rate is not None:
            qty, unit, rate, amt = 1.0, "Lump", rate, rate
        if amt is None: continue
        if qty is None or rate is None:
            qty, unit, rate = 1.0, unit or "Lump", amt
        out.append((desc, qty, unit or "Nos", rate, amt))
    return out

print("-- =============================================================")
print("-- EzMoney — his old Excel bills, as history")
print("--")
print("-- Five sheets he kept from 2017 to 2022, read straight out of the")
print("-- workbooks rather than retyped. Every invoice is imported already")
print("-- settled, with a payment against it on its own date, so none of")
print("-- this lands in \"still to collect\" — it is history, not money owed.")
print("--")
print("-- Serial numbers use each bill's own year, and next_serial counts")
print("-- per year, so nothing here can collide with a 2026 bill.")
print("--")
print("-- Safe to run twice: a serial that already exists is skipped.")
print("-- =============================================================")
print()
print("do $$")
print("declare")
print("  v_user uuid;")
print("  v_client uuid;")
print("  v_doc uuid;")
print("begin")
print("  select id into v_user from auth.users order by created_at limit 1;")
print("  if v_user is null then raise exception 'No user found.'; end if;")
print()

for sp in SPECS:
    grids = sheet(BASE + sp["file"])
    grid = grids[0][1]
    lines = []
    for sec, lo, hi in sp["sections"]:
        for d, qy, u, rt, am in rows_for(grid, sp["off"], lo, hi):
            lines.append((sec, d, qy, u, rt, am))
    for label, pct in sp.get("discount", []):
        cut = round(-sum(l[5] for l in lines) * pct, 2)
        lines.append(("", label, 1.0, "Lump", cut, cut))
    total = round(sum(l[5] for l in lines), 2)
    if not lines: continue
    print(f"  -- ---------- {sp['client']} · {sp['date']} · {len(lines)} lines · Rs {total:,.2f} ----------")
    print(f"  if not exists (select 1 from public.documents where user_id = v_user and serial_no = {q(sp['serial'])}) then")
    print(f"    select id into v_client from public.clients where user_id = v_user and name = {q(sp['client'])};")
    print(f"    if v_client is null then")
    print(f"      insert into public.clients (user_id, name, address)")
    print(f"      values (v_user, {q(sp['client'])}, 'Bangalore') returning id into v_client;")
    print(f"    end if;")
    print()
    st = "paid" if sp["type"] == "invoice" else "approved"
    recv = total if sp["type"] == "invoice" else 0
    print(f"    insert into public.documents")
    print(f"      (user_id, type, serial_no, doc_date, client_id, site_job, status,")
    print(f"       subtotal, taxable_value, total, amount_received, notes)")
    print(f"    values (v_user, {q(sp['type'])}, {q(sp['serial'])}, {q(sp['date'])}, v_client,")
    print(f"       {q(sp['job'])}, {q(st)}, {total}, {total}, {total}, {recv},")
    print(f"       'Imported from his own Excel sheet.')")
    print(f"    returning id into v_doc;")
    print()
    print(f"    insert into public.line_items")
    print(f"      (user_id, document_id, position, section, description, qty, unit, rate, amount) values")
    vals = []
    for i, (sec, d, qy, u, rt, am) in enumerate(lines, 1):
        vals.append(f"      (v_user, v_doc, {i}, {q(sec)}, {q(d)}, {qy}, {q(u)}, {rt}, {round(am,2)})")
    print(",\n".join(vals) + ";")
    if sp["type"] == "invoice":
        print()
        print(f"    insert into public.payments (user_id, document_id, paid_on, amount, method, notes)")
        print(f"    values (v_user, v_doc, {q(sp['date'])}, {total}, 'Cash', 'Imported — settled.');")
    print("  end if;")
    print()

print("end $$;")
print()
print("-- Check: five bills, oldest first.")
print("select serial_no, doc_date, status, total,")
print("       (select count(*) from public.line_items l where l.document_id = d.id) as lines")
print("  from public.documents d")
print(" where notes = 'Imported from his own Excel sheet.'")
print(" order by doc_date;")
