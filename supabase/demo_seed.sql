-- =============================================================
-- Sample data for the DEMO copy only (Supabase project "EzMoney Demo",
-- ref hxfgweesgrajacknedbd). Never run this on his database.
--
-- A made-up website studio rather than an electrician, because the
-- people who see the demo are not electricians. GST is on, one client
-- is in Mumbai so an IGST invoice is there to look at, one invoice is
-- part paid after a 20% advance, and a monthly maintenance bill sits
-- next to the one that was paid last month.
--
-- Re-runnable: it clears the demo user's rows first, so anything a
-- visitor typed is wiped and the demo starts clean again.
-- =============================================================

do $$
declare
  u uuid;
  c_lotus uuid; c_brew uuid; c_mehta uuid; c_yoga uuid; c_kumar uuid;
  d_est1 uuid; d_inv1 uuid; d_inv2 uuid; d_inv3 uuid; d_inv4 uuid; d_inv5 uuid; d_est2 uuid;
begin
  select id into u from auth.users where email = 'demo@ezmoney.invalid';
  if u is null then raise exception 'demo user missing'; end if;

  delete from public.payments where user_id = u;
  delete from public.expenses where user_id = u;
  delete from public.documents where user_id = u;
  delete from public.clients where user_id = u;
  delete from public.rate_card_items where user_id = u;
  delete from public.doc_counters where user_id = u;
  delete from public.business_profile where user_id = u;

  insert into public.business_profile
    (user_id, business_name, proprietor_name, address, city_pin, phone, email,
     gstin, gst_enabled, gst_rate, state_code, state_name, default_hsn_sac,
     bank_name, bank_branch, account_no, ifsc, upi_id, payment_terms, terms)
  values
    (u, 'Demo Web Studio', 'Your Name', '2nd Floor, 100 Feet Road, Indiranagar',
     'Bengaluru 560038', '+91 90000 00000', 'hello@example.com',
     '29AAAAA0000A1Z5', true, 0.18, '29', 'Karnataka', '998314',
     'Demo Bank', 'Indiranagar', '000000000000', 'DEMO0000000', 'demo@example',
     'Payment due within 15 days of invoice date.',
     'Website content and domain pass to the client once paid in full.
Hosting and maintenance renew monthly.
Work pauses if a bill is unpaid 15 days after its due date.');

  insert into public.clients (user_id, name, phone, address, state_code, state_name, gstin)
    values (u, 'Lotus Dental Clinic', '', '14, 9th Main, Jayanagar, Bengaluru', '29', 'Karnataka', '29BBBBB1111B1Z2')
    returning id into c_lotus;
  insert into public.clients (user_id, name, phone, address, state_code, state_name)
    values (u, 'Brew & Bean Cafe', '', '80 Feet Road, Koramangala, Bengaluru', '29', 'Karnataka')
    returning id into c_brew;
  insert into public.clients (user_id, name, phone, address, state_code, state_name, gstin)
    values (u, 'Mehta Interiors', '', 'Link Road, Andheri West, Mumbai', '27', 'Maharashtra', '27CCCCC2222C1Z9')
    returning id into c_mehta;
  insert into public.clients (user_id, name, phone, address, state_code, state_name)
    values (u, 'Sunrise Yoga Studio', '', 'Sector 2, HSR Layout, Bengaluru', '29', 'Karnataka')
    returning id into c_yoga;
  insert into public.clients (user_id, name, phone, address, state_code, state_name)
    values (u, 'Kumar Tutorials', '', '15th Cross, Malleshwaram, Bengaluru', '29', 'Karnataka')
    returning id into c_kumar;

  -- Quote, accepted, turned into the invoice below.
  insert into public.documents (user_id, type, serial_no, doc_date, client_id, site_job, status,
      subtotal, taxable_value, cgst_amount, sgst_amount, igst_amount, gst_amount, total, place_of_supply)
    values (u, 'estimate', 'EST-2026-001', '2026-08-10', c_lotus, 'Clinic website — 6 pages + booking form',
      'approved', 27500, 27500, 2475, 2475, 0, 4950, 32450, '29')
    returning id into d_est1;
  insert into public.documents (user_id, type, serial_no, doc_date, due_date, client_id, site_job, status,
      linked_estimate_id, subtotal, taxable_value, cgst_amount, sgst_amount, igst_amount, gst_amount, total,
      place_of_supply, amount_received)
    values (u, 'invoice', 'INV-2026-001', '2026-08-12', '2026-08-27', c_lotus, 'Clinic website — 6 pages + booking form',
      'paid', d_est1, 27500, 27500, 2475, 2475, 0, 4950, 32450, '29', 32450)
    returning id into d_inv1;

  -- Monthly maintenance: September paid, October still out.
  insert into public.documents (user_id, type, serial_no, doc_date, due_date, client_id, site_job, status,
      subtotal, taxable_value, cgst_amount, sgst_amount, igst_amount, gst_amount, total, place_of_supply, amount_received)
    values (u, 'invoice', 'INV-2026-002', '2026-09-01', '2026-09-16', c_brew, 'Website maintenance — September',
      'paid', 3000, 3000, 270, 270, 0, 540, 3540, '29', 3540)
    returning id into d_inv2;
  insert into public.documents (user_id, type, serial_no, doc_date, due_date, client_id, site_job, status,
      subtotal, taxable_value, cgst_amount, sgst_amount, igst_amount, gst_amount, total, place_of_supply, amount_received)
    values (u, 'invoice', 'INV-2026-003', '2026-10-01', '2026-10-16', c_brew, 'Website maintenance — October',
      'sent', 3000, 3000, 270, 270, 0, 540, 3540, '29', 0)
    returning id into d_inv3;

  -- Out of state, so IGST. 20% advance taken, balance owed.
  insert into public.documents (user_id, type, serial_no, doc_date, due_date, client_id, site_job, status,
      subtotal, taxable_value, cgst_amount, sgst_amount, igst_amount, gst_amount, total, place_of_supply, amount_received)
    values (u, 'invoice', 'INV-2026-004', '2026-09-20', '2026-10-05', c_mehta, 'Portfolio website + SEO setup',
      'partly_paid', 45000, 45000, 0, 0, 8100, 8100, 53100, '27', 10620)
    returning id into d_inv4;

  -- Not sent yet.
  insert into public.documents (user_id, type, serial_no, doc_date, due_date, client_id, site_job, status,
      subtotal, taxable_value, cgst_amount, sgst_amount, igst_amount, gst_amount, total, place_of_supply, amount_received)
    values (u, 'invoice', 'INV-2026-005', '2026-10-18', '2026-11-02', c_yoga, 'Landing page + logo refresh',
      'draft', 15000, 15000, 1350, 1350, 0, 2700, 17700, '29', 0)
    returning id into d_inv5;

  insert into public.documents (user_id, type, serial_no, doc_date, client_id, site_job, status,
      subtotal, taxable_value, cgst_amount, sgst_amount, igst_amount, gst_amount, total, place_of_supply)
    values (u, 'estimate', 'EST-2026-002', '2026-10-24', c_kumar, 'School website with results page',
      'sent', 31000, 31000, 2790, 2790, 0, 5580, 36580, '29')
    returning id into d_est2;

  insert into public.line_items (user_id, document_id, position, description, qty, unit, rate, amount, hsn_sac, gst_rate) values
    (u, d_est1, 1, 'Website design & development (6 pages)', 1, 'Job', 20000, 20000, '998314', 0.18),
    (u, d_est1, 2, 'Appointment booking form', 1, 'Job', 4000, 4000, '998314', 0.18),
    (u, d_est1, 3, 'Domain + 1 year hosting', 1, 'Nos', 3500, 3500, '998315', 0.18),
    (u, d_inv1, 1, 'Website design & development (6 pages)', 1, 'Job', 20000, 20000, '998314', 0.18),
    (u, d_inv1, 2, 'Appointment booking form', 1, 'Job', 4000, 4000, '998314', 0.18),
    (u, d_inv1, 3, 'Domain + 1 year hosting', 1, 'Nos', 3500, 3500, '998315', 0.18),
    (u, d_inv2, 1, 'Monthly website maintenance — September', 1, 'Job', 3000, 3000, '998314', 0.18),
    (u, d_inv3, 1, 'Monthly website maintenance — October', 1, 'Job', 3000, 3000, '998314', 0.18),
    (u, d_inv4, 1, 'Portfolio website (8 pages)', 1, 'Job', 35000, 35000, '998314', 0.18),
    (u, d_inv4, 2, 'SEO setup', 1, 'Job', 8000, 8000, '998314', 0.18),
    (u, d_inv4, 3, 'Google Business Profile setup', 1, 'Job', 2000, 2000, '998314', 0.18),
    (u, d_inv5, 1, 'Landing page with link-in-bio', 1, 'Job', 12000, 12000, '998314', 0.18),
    (u, d_inv5, 2, 'Logo refresh', 1, 'Job', 3000, 3000, '998314', 0.18),
    (u, d_est2, 1, 'School website (8 pages)', 1, 'Job', 25000, 25000, '998314', 0.18),
    (u, d_est2, 2, 'Results upload page', 1, 'Job', 6000, 6000, '998314', 0.18);

  insert into public.payments (user_id, document_id, paid_on, amount, method, notes) values
    (u, d_inv1, '2026-08-12', 6490, 'UPI', '20% advance'),
    (u, d_inv1, '2026-09-05', 25960, 'Bank', 'Balance on launch'),
    (u, d_inv2, '2026-09-06', 3540, 'UPI', ''),
    (u, d_inv4, '2026-09-20', 10620, 'Bank', '20% advance');

  insert into public.expenses (user_id, date, category, item, vendor, amount, paid_via) values
    (u, '2026-09-01', 'Misc', 'Hosting server — September', 'Hosting provider', 1200, 'Card'),
    (u, '2026-10-01', 'Misc', 'Hosting server — October', 'Hosting provider', 1200, 'Card');

  insert into public.rate_card_items (user_id, description, unit, rate, hsn_sac, category, times_used) values
    (u, 'Website design & development', 'Job', 20000, '998314', 'Work', 3),
    (u, 'Monthly website maintenance', 'Job', 3000, '998314', 'Work', 2),
    (u, 'Domain + 1 year hosting', 'Nos', 3500, '998315', 'Work', 1),
    (u, 'SEO setup', 'Job', 8000, '998314', 'Work', 1),
    (u, 'Landing page', 'Job', 12000, '998314', 'Work', 1),
    (u, 'Logo design', 'Job', 3000, '998314', 'Work', 1);

  insert into public.doc_counters (user_id, doc_type, year_key, last_seq)
    values (u, 'estimate', '2026', 2), (u, 'invoice', '2026', 5);
end $$;
