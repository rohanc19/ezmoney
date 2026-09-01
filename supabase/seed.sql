-- =============================================================
-- EzMoney — seed data for testing
--
-- HOW TO RUN: first create your user (Supabase dashboard →
-- Authentication → Add user, e.g. dad's email + a password).
-- Then run this whole file in the SQL Editor. It attaches all
-- seed data to the FIRST user in auth.users.
-- Safe to run once; running twice will duplicate the demo rows.
-- =============================================================

do $$
declare
  v_user uuid;
  v_client uuid;
  v_est uuid;
  v_inv uuid;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'No user found. Create a user in Authentication first, then re-run.';
  end if;

  -- business profile
  insert into public.business_profile
    (user_id, business_name, proprietor_name, address, city_pin, phone, email,
     gst_enabled, bank_name, account_no, ifsc, upi_id)
  values
    (v_user, 'Sri Manjunatha Electricals', 'Chandrashekar', '#12, 4th Cross, Vidyaranyapura',
     'Bengaluru 560097', '+91 98450 00000', 'example@gmail.com',
     false, 'Canara Bank', '110012345678', 'CNRB0001234', 'chandru@oksbi')
  on conflict (user_id) do nothing;

  -- a client
  insert into public.clients (user_id, name, phone, address, notes)
  values (v_user, 'Ramesh Kumar', '+91 99860 11111', 'Flat 302, Shubha Residency, Jalahalli', 'Referred by Suresh')
  returning id into v_client;

  -- estimate EST-2026-001 for a 2BHK rewiring job
  insert into public.documents
    (user_id, type, serial_no, doc_date, client_id, site_job, status, subtotal, gst_amount, total)
  values
    (v_user, 'estimate', 'EST-2026-001', date '2026-08-10', v_client,
     '2BHK full rewiring — Shubha Residency, Flat 302', 'approved', 28150, 0, 28150)
  returning id into v_est;

  insert into public.line_items (user_id, document_id, position, description, qty, unit, rate, amount) values
    (v_user, v_est, 1, 'Finolex 1.5 sq mm FR wire (90 m coil)', 4, 'Set', 1850, 7400),
    (v_user, v_est, 2, 'Finolex 2.5 sq mm FR wire (90 m coil)', 2, 'Set', 2900, 5800),
    (v_user, v_est, 3, 'Modular switch points (Anchor Roma)', 35, 'Point', 260, 9100),
    (v_user, v_est, 4, 'MCB distribution board 8-way with MCBs', 1, 'Nos', 3350, 3350),
    (v_user, v_est, 5, 'Labour — rewiring and finishing', 1, 'Job', 2500, 2500);

  -- the converted invoice INV-2026-001 (final quantities differ slightly)
  insert into public.documents
    (user_id, type, serial_no, doc_date, client_id, site_job, status, linked_estimate_id, subtotal, gst_amount, total)
  values
    (v_user, 'invoice', 'INV-2026-001', date '2026-08-24', v_client,
     '2BHK full rewiring — Shubha Residency, Flat 302', 'paid', v_est, 29010, 0, 29010)
  returning id into v_inv;

  insert into public.line_items (user_id, document_id, position, description, qty, unit, rate, amount) values
    (v_user, v_inv, 1, 'Finolex 1.5 sq mm FR wire (90 m coil)', 4, 'Set', 1850, 7400),
    (v_user, v_inv, 2, 'Finolex 2.5 sq mm FR wire (90 m coil)', 2, 'Set', 2900, 5800),
    (v_user, v_inv, 3, 'Modular switch points (Anchor Roma)', 37, 'Point', 260, 9620),
    (v_user, v_inv, 4, 'MCB distribution board 8-way with MCBs', 1, 'Nos', 3350, 3350),
    (v_user, v_inv, 5, 'Labour — rewiring and finishing', 1, 'Job', 2840, 2840);

  -- keep the serial counters in sync with the seeded documents
  insert into public.doc_counters (user_id, doc_type, year_key, last_seq)
  values (v_user, 'estimate', '2026', 1), (v_user, 'invoice', '2026', 1)
  on conflict (user_id, doc_type, year_key)
  do update set last_seq = greatest(public.doc_counters.last_seq, excluded.last_seq);

  -- a couple of expenses
  insert into public.expenses (user_id, date, category, item, vendor, amount, client_id, paid_via) values
    (v_user, date '2026-08-18', 'Materials', 'Wire coils and switches for Flat 302', 'Sri Balaji Electricals, Yeshwanthpur', 21400, v_client, 'UPI'),
    (v_user, date '2026-08-20', 'Transport', 'Auto to site (material delivery)', '', 350, v_client, 'Cash');

  raise notice 'Seed complete for user %', v_user;
end $$;
