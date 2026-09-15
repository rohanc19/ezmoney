-- =============================================================
-- EzMoney — his old Excel bills, as history
--
-- Five sheets he kept from 2017 to 2022, read straight out of the
-- workbooks rather than retyped. Every invoice is imported already
-- settled, with a payment against it on its own date, so none of
-- this lands in "still to collect" — it is history, not money owed.
--
-- Serial numbers use each bill's own year, and next_serial counts
-- per year, so nothing here can collide with a 2026 bill.
--
-- Safe to run twice: a serial that already exists is skipped.
-- =============================================================

do $$
declare
  v_user uuid;
  v_client uuid;
  v_doc uuid;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then raise exception 'No user found.'; end if;

  -- ---------- Ramesh Eng Uttarahalli · 2019-10-15 · 72 lines · Rs 41,874.00 ----------
  if not exists (select 1 from public.documents where user_id = v_user and serial_no = 'INV-2019-001') then
    select id into v_client from public.clients where user_id = v_user and name = 'Ramesh Eng Uttarahalli';
    if v_client is null then
      insert into public.clients (user_id, name, address)
      values (v_user, 'Ramesh Eng Uttarahalli', 'Bangalore') returning id into v_client;
    end if;

    insert into public.documents
      (user_id, type, serial_no, doc_date, client_id, site_job, status,
       subtotal, taxable_value, total, amount_received, notes)
    values (v_user, 'invoice', 'INV-2019-001', '2019-10-15', v_client,
       'Electrical work — Uttarahalli', 'paid', 41874.0, 41874.0, 41874.0, 41874.0,
       'Imported from his own Excel sheet.')
    returning id into v_doc;

    insert into public.line_items
      (user_id, document_id, position, section, description, qty, unit, rate, amount) values
      (v_user, v_doc, 1, 'Kitchen Groove Cutting', '3/4 " P V C  Pipe', 4.0, 'No', 45.0, 180.0),
      (v_user, v_doc, 2, 'Kitchen Groove Cutting', '3/4 "  Bend', 12.0, 'No', 6.0, 72.0),
      (v_user, v_doc, 3, 'Kitchen Groove Cutting', '3/4 "  Colar', 12.0, 'No', 4.0, 48.0),
      (v_user, v_doc, 4, 'Kitchen Groove Cutting', 'S S  Niles', 0.25, 'Kg', 200.0, 50.0),
      (v_user, v_doc, 5, 'Kitchen Groove Cutting', 'Hexea Blade', 2.0, 'No', 10.0, 20.0),
      (v_user, v_doc, 6, 'Kitchen Groove Cutting', 'Tape Role', 2.0, 'No', 15.0, 30.0),
      (v_user, v_doc, 7, 'Kitchen Groove Cutting', '8 Modal Metal Box', 3.0, 'No', 140.0, 420.0),
      (v_user, v_doc, 8, 'Kitchen Groove Cutting', '4 Modal Metal Box', 1.0, 'No', 95.0, 95.0),
      (v_user, v_doc, 9, 'Kitchen Groove Cutting', '2 Modal Metal Box', 2.0, 'No', 60.0, 120.0),
      (v_user, v_doc, 10, 'Kitchen Groove Cutting', 'Grue Cutting Blade', 1.0, 'No', 125.0, 125.0),
      (v_user, v_doc, 11, 'Kitchen Groove Cutting', 'Metal Cutting Blade', 2.0, 'No', 50.0, 100.0),
      (v_user, v_doc, 12, 'Kitchen Groove Cutting', 'Labour Charges', 1.0, 'Lump', 3000.0, 3000.0),
      (v_user, v_doc, 13, 'Ground Floor Bath Room', '3/4 "  Casing', 1.0, 'No', 45.0, 45.0),
      (v_user, v_doc, 14, 'Ground Floor Bath Room', '1 Sqmm Copper Wire', 6.0, 'No', 20.0, 120.0),
      (v_user, v_doc, 15, 'Ground Floor Bath Room', 'Round Black', 1.0, 'No', 10.0, 10.0),
      (v_user, v_doc, 16, 'Ground Floor Bath Room', 'Batten Holder', 1.0, 'No', 40.0, 40.0),
      (v_user, v_doc, 17, 'Ground Floor Bath Room', 'Tube Light Adopter', 1.0, 'No', 20.0, 20.0),
      (v_user, v_doc, 18, 'Ground Floor Bath Room', '2 Feet 20 W  L E D Tube', 1.0, 'No', 450.0, 450.0),
      (v_user, v_doc, 19, 'Ground Floor Bath Room', 'Labour Charges', 1.0, 'Lump', 1000.0, 1000.0),
      (v_user, v_doc, 20, 'First Floor Molding', '1 "   V I P  Pipe', 10.0, 'No', 96.0, 960.0),
      (v_user, v_doc, 21, 'First Floor Molding', '3/4 "  V I P  Pipe', 10.0, 'No', 70.0, 700.0),
      (v_user, v_doc, 22, 'First Floor Molding', '1 " Bend', 2.0, 'Doz', 96.0, 192.0),
      (v_user, v_doc, 23, 'First Floor Molding', '1"  Collar', 2.0, 'Doz', 72.0, 144.0),
      (v_user, v_doc, 24, 'First Floor Molding', '1" Closer', 2.0, 'Doz', 36.0, 72.0),
      (v_user, v_doc, 25, 'First Floor Molding', '3/4 "  Bend', 2.0, 'Doz', 72.0, 144.0),
      (v_user, v_doc, 26, 'First Floor Molding', '3/4 " Collar', 2.0, 'Doz', 48.0, 96.0),
      (v_user, v_doc, 27, 'First Floor Molding', '3/4 " Closer', 2.0, 'Doz', 24.0, 48.0),
      (v_user, v_doc, 28, 'First Floor Molding', 'Fan Box', 2.0, 'No', 100.0, 200.0),
      (v_user, v_doc, 29, 'First Floor Molding', '1 "  Deep Juncton Box', 1.0, 'No', 40.0, 40.0),
      (v_user, v_doc, 30, 'First Floor Molding', '3/4 " Deep Juncton Box', 2.0, 'No', 40.0, 80.0),
      (v_user, v_doc, 31, 'First Floor Molding', 'Tape Role', 4.0, 'No', 15.0, 60.0),
      (v_user, v_doc, 32, 'First Floor Molding', 'Brown Tape', 1.0, 'No', 60.0, 60.0),
      (v_user, v_doc, 33, 'First Floor Molding', 'Hexea Blade', 3.0, 'No', 10.0, 30.0),
      (v_user, v_doc, 34, 'First Floor Molding', 'Solution', 2.0, 'Bottle', 45.0, 90.0),
      (v_user, v_doc, 35, 'First Floor Molding', 'Labor Charges', 1.0, 'Lump', 4000.0, 4000.0),
      (v_user, v_doc, 36, 'Kitchen Plate', '8 Modal Ligrand Plate', 3.0, 'No', 190.0, 570.0),
      (v_user, v_doc, 37, 'Kitchen Plate', '4 Modal Ligrand Plate', 1.0, 'No', 100.0, 100.0),
      (v_user, v_doc, 38, 'Kitchen Plate', '2 Modal Ligrand Plate', 2.0, 'No', 85.0, 170.0),
      (v_user, v_doc, 39, 'Kitchen Plate', '32 A  Ligrand D P', 4.0, 'No', 495.0, 1980.0),
      (v_user, v_doc, 40, 'Kitchen Plate', '15 A  Ligrand 2x1 Socket', 4.0, 'No', 225.0, 900.0),
      (v_user, v_doc, 41, 'Kitchen Plate', '6 A  Ligrand Switch', 5.0, 'No', 75.0, 375.0),
      (v_user, v_doc, 42, 'Kitchen Plate', '6 A  Ligrand 2x1 Socket', 4.0, 'No', 165.0, 660.0),
      (v_user, v_doc, 43, 'Kitchen Plate', 'Blank Plate', 3.0, 'No', 30.0, 90.0),
      (v_user, v_doc, 44, 'Kitchen Plate', 'Checkey', 3.0, 'No', 10.0, 30.0),
      (v_user, v_doc, 45, 'Kitchen Plate', 'Batten & Angular Holder', 2.0, 'No', 40.0, 80.0),
      (v_user, v_doc, 46, 'Kitchen Plate', 'Lisha 5 A  2x1 Socket', 1.0, 'No', 45.0, 45.0),
      (v_user, v_doc, 47, 'Kitchen Plate', 'M T  Box', 1.0, 'No', 25.0, 25.0),
      (v_user, v_doc, 48, 'Kitchen Plate', 'L E D 4 Feet Tube Set', 1.0, 'No', 450.0, 450.0),
      (v_user, v_doc, 49, 'Kitchen Plate', 'Tube Light Adopter', 1.0, 'No', 20.0, 20.0),
      (v_user, v_doc, 50, 'Kitchen Plate', '4 Sqmm Copper Wire', 32.0, 'Met', 40.0, 1280.0),
      (v_user, v_doc, 51, 'Kitchen Plate', '2.5 Sqmm Copper Wire', 36.0, 'Met', 25.0, 900.0),
      (v_user, v_doc, 52, 'Kitchen Plate', '1 Sqmm Copper Wire', 32.0, 'Met', 20.0, 640.0),
      (v_user, v_doc, 53, 'Kitchen Plate', 'Tape Role', 3.0, 'No', 20.0, 60.0),
      (v_user, v_doc, 54, 'Kitchen Plate', 'Labour Charges', 1.0, 'Lump', 5000.0, 5000.0),
      (v_user, v_doc, 55, 'First Floor Groove Cutting', '3/4 " P V C  Pipe', 10.0, 'No', 45.0, 450.0),
      (v_user, v_doc, 56, 'First Floor Groove Cutting', '3/4 "  Bend', 24.0, 'No', 5.0, 120.0),
      (v_user, v_doc, 57, 'First Floor Groove Cutting', '3/4 "  Collar', 12.0, 'No', 4.0, 48.0),
      (v_user, v_doc, 58, 'First Floor Groove Cutting', 'S S  Niles', 1.0, 'Kg', 200.0, 200.0),
      (v_user, v_doc, 59, 'First Floor Groove Cutting', 'Hexea Blade', 2.0, 'No', 10.0, 20.0),
      (v_user, v_doc, 60, 'First Floor Groove Cutting', 'Tape Role', 4.0, 'No', 15.0, 60.0),
      (v_user, v_doc, 61, 'First Floor Groove Cutting', '8 Modal Metal Box', 6.0, 'No', 140.0, 840.0),
      (v_user, v_doc, 62, 'First Floor Groove Cutting', '4 Modal Metal Box', 4.0, 'No', 95.0, 380.0),
      (v_user, v_doc, 63, 'First Floor Groove Cutting', '2 Modal Metal Box', 3.0, 'No', 60.0, 180.0),
      (v_user, v_doc, 64, 'First Floor Groove Cutting', 'Grue Cutting Blade', 2.0, 'No', 125.0, 250.0),
      (v_user, v_doc, 65, 'First Floor Groove Cutting', 'Metal Cutting Blade', 5.0, 'No', 50.0, 250.0),
      (v_user, v_doc, 66, 'First Floor Groove Cutting', '1 " Pipe', 18.0, 'No', 48.0, 864.0),
      (v_user, v_doc, 67, 'First Floor Groove Cutting', '1"  Bend', 3.0, 'Doz', 72.0, 216.0),
      (v_user, v_doc, 68, 'First Floor Groove Cutting', '1 " Colar', 1.0, 'Doz', 60.0, 60.0),
      (v_user, v_doc, 69, 'First Floor Groove Cutting', '3/4 " Juncton Box', 6.0, 'No', 25.0, 150.0),
      (v_user, v_doc, 70, 'First Floor Groove Cutting', '1 " Juncton Box', 15.0, 'No', 30.0, 450.0),
      (v_user, v_doc, 71, 'First Floor Groove Cutting', 'D B  Box', 1.0, 'No', 1100.0, 1100.0),
      (v_user, v_doc, 72, 'First Floor Groove Cutting', 'Labour Charges', 1.0, 'Lump', 10000.0, 10000.0);

    insert into public.payments (user_id, document_id, paid_on, amount, method, notes)
    values (v_user, v_doc, '2019-10-15', 41874.0, 'Cash', 'Imported — settled.');
  end if;

  -- ---------- Mr Vardhaman · 2020-06-25 · 50 lines · Rs 682,254.00 ----------
  if not exists (select 1 from public.documents where user_id = v_user and serial_no = 'INV-2020-001') then
    select id into v_client from public.clients where user_id = v_user and name = 'Mr Vardhaman';
    if v_client is null then
      insert into public.clients (user_id, name, address)
      values (v_user, 'Mr Vardhaman', 'Bangalore') returning id into v_client;
    end if;

    insert into public.documents
      (user_id, type, serial_no, doc_date, client_id, site_job, status,
       subtotal, taxable_value, total, amount_received, notes)
    values (v_user, 'invoice', 'INV-2020-001', '2020-06-25', v_client,
       'Electrical work', 'paid', 682254.0, 682254.0, 682254.0, 682254.0,
       'Imported from his own Excel sheet.')
    returning id into v_doc;

    insert into public.line_items
      (user_id, document_id, position, section, description, qty, unit, rate, amount) values
      (v_user, v_doc, 1, 'Wiring', 'Light   point', 143.0, 'No', 550.0, 78650.0),
      (v_user, v_doc, 2, 'Wiring', 'Fan  point', 11.0, 'No', 1100.0, 12100.0),
      (v_user, v_doc, 3, 'Wiring', '2  Way  light  point', 14.0, 'No', 900.0, 12600.0),
      (v_user, v_doc, 4, 'Wiring', 'Plug  point', 110.0, 'No', 550.0, 60500.0),
      (v_user, v_doc, 5, 'Wiring', 'Lighting  circuit /  Feet', 1650.0, 'Feet', 45.0, 74250.0),
      (v_user, v_doc, 6, 'Wiring', 'Heating  point', 21.0, 'No', 850.0, 17850.0),
      (v_user, v_doc, 7, 'Wiring', 'Heating   circuit /  feet', 1450.0, 'feet', 55.0, 79750.0),
      (v_user, v_doc, 8, 'Wiring', 'Antena  point', 5.0, 'No', 450.0, 2250.0),
      (v_user, v_doc, 9, 'Wiring', 'Antena   circuit  /Feet', 700.0, 'Feet', 40.0, 28000.0),
      (v_user, v_doc, 10, 'Wiring', 'Main  board   D   B  box  fixing  12 Way', 6.0, 'No', 4500.0, 27000.0),
      (v_user, v_doc, 11, 'Wiring', 'Main Circuit From Meter Board To D B', 500.0, 'Feet', 160.0, 80000.0),
      (v_user, v_doc, 12, 'Wiring', 'U P S  Point', 2.0, 'No', 1000.0, 2000.0),
      (v_user, v_doc, 13, 'Wiring', 'U P S  Circuit', 400.0, 'Feet', 85.0, 34000.0),
      (v_user, v_doc, 14, 'Wiring', 'Pipe  with  U.G   cable /  feet 35Sqmm', 75.0, 'Feet', 300.0, 22500.0),
      (v_user, v_doc, 15, 'Wiring', 'Potted', 1.0, 'No', 800.0, 800.0),
      (v_user, v_doc, 16, 'Wiring', 'Grounding', 6.0, 'No', 4500.0, 27000.0),
      (v_user, v_doc, 17, 'Wiring', 'C C Camara Point', 9.0, 'No', 300.0, 2700.0),
      (v_user, v_doc, 18, 'Wiring', 'C C Camara Circuit', 600.0, 'Feet', 40.0, 24000.0),
      (v_user, v_doc, 19, 'Wiring', 'Motar Point', 2.0, 'No', 800.0, 1600.0),
      (v_user, v_doc, 20, 'Wiring', 'Motar Circuit', 100.0, 'Feet', 60.0, 6000.0),
      (v_user, v_doc, 21, 'Wiring', 'Waterleval Control Circuit', 200.0, 'Feet', 30.0, 6000.0),
      (v_user, v_doc, 22, 'Wiring', 'Fuse Cutout Set', 1.0, 'No', 2000.0, 2000.0),
      (v_user, v_doc, 23, 'Wiring', 'Water Leval Control', 1.0, 'No', 4500.0, 4500.0),
      (v_user, v_doc, 24, 'Wiring', 'Cat 6 Wiring For Vedio Door Phone', 220.0, 'Feet', 45.0, 9900.0),
      (v_user, v_doc, 25, 'Wiring', 'Lift Wiring', 1.0, 'Lump', 20000.0, 20000.0),
      (v_user, v_doc, 26, 'Wiring', 'Lift Panel/ E L C B/ M CB', 1.0, 'Lump', 12000.0, 12000.0),
      (v_user, v_doc, 27, 'Wiring', 'Earth Copper Wire Running', 180.0, 'Feet', 40.0, 7200.0),
      (v_user, v_doc, 28, 'Wiring', 'Lift Main Circuit', 150.0, 'Feet', 160.0, 24000.0),
      (v_user, v_doc, 29, 'Wiring', '6 Sqmm4 Wire Circuit For 6 K V A  U P S', 150.0, 'Feet', 180.0, 27000.0),
      (v_user, v_doc, 30, 'Wiring', 'Panel Board Fixing & Connecting', 1.0, 'Lump', 10000.0, 10000.0),
      (v_user, v_doc, 31, 'Wiring', '1.5 Sqmm 4 Run Wire', 150.0, 'Feet', 40.0, 6000.0),
      (v_user, v_doc, 32, 'Wiring', 'Colling Bell Water Proof Point', 2.0, 'No', 800.0, 1600.0),
      (v_user, v_doc, 33, 'Wiring', 'Telephone Point', 4.0, 'No', 450.0, 1800.0),
      (v_user, v_doc, 34, 'Wiring', 'Telephone Circuit', 200.0, 'Feet', 25.0, 5000.0),
      (v_user, v_doc, 35, 'Fitting', 'Cealing Fan  Fixing', 8.0, 'No', 250.0, 2000.0),
      (v_user, v_doc, 36, 'Fitting', 'Exast Fan  Fixing', 8.0, 'No', 30.0, 240.0),
      (v_user, v_doc, 37, 'Fitting', 'Mirror Light Fitting', 6.0, 'No', 75.0, 450.0),
      (v_user, v_doc, 38, 'Fitting', 'Bulked Fitting  Fixing', 2.0, 'No', 75.0, 150.0),
      (v_user, v_doc, 39, 'Fitting', 'Colling Bell  Fixing', 4.0, 'No', 50.0, 200.0),
      (v_user, v_doc, 40, 'Fitting', 'Cealing Fitting', 64.0, 'No', 100.0, 6400.0),
      (v_user, v_doc, 41, 'Fitting', 'Wall Fitting', 30.0, 'No', 75.0, 2250.0),
      (v_user, v_doc, 42, 'Extra', 'D B  Box', 5.0, 'No', 950.0, 4750.0),
      (v_user, v_doc, 43, 'Extra', 'Lift L ED  Bulb', 4.0, 'No', 150.0, 600.0),
      (v_user, v_doc, 44, 'Extra', 'Thread Type 9 W  Bulb', 6.0, 'No', 175.0, 1050.0),
      (v_user, v_doc, 45, 'Extra', '5 A  3 Pin Top', 1.0, 'No', 40.0, 40.0),
      (v_user, v_doc, 46, 'Extra', '60W  Bulb', 12.0, 'No', 15.0, 180.0),
      (v_user, v_doc, 47, 'Extra', '1W  L E D  Bulb', 1.0, 'No', 290.0, 290.0),
      (v_user, v_doc, 48, 'Extra', '15 A  Plug', 6.0, 'No', 85.0, 510.0),
      (v_user, v_doc, 49, 'Extra', '40 A  E L C B', 3.0, 'No', 2800.0, 8400.0),
      (v_user, v_doc, 50, '', 'Less 10%', 1.0, 'Lump', -75806.0, -75806.0);

    insert into public.payments (user_id, document_id, paid_on, amount, method, notes)
    values (v_user, v_doc, '2020-06-25', 682254.0, 'Cash', 'Imported — settled.');
  end if;

  -- ---------- Chandramouly · 2022-02-27 · 21 lines · Rs 27,073.00 ----------
  if not exists (select 1 from public.documents where user_id = v_user and serial_no = 'INV-2022-001') then
    select id into v_client from public.clients where user_id = v_user and name = 'Chandramouly';
    if v_client is null then
      insert into public.clients (user_id, name, address)
      values (v_user, 'Chandramouly', 'Bangalore') returning id into v_client;
    end if;

    insert into public.documents
      (user_id, type, serial_no, doc_date, client_id, site_job, status,
       subtotal, taxable_value, total, amount_received, notes)
    values (v_user, 'invoice', 'INV-2022-001', '2022-02-27', v_client,
       'Single phase T.P. board', 'paid', 27073.0, 27073.0, 27073.0, 27073.0,
       'Imported from his own Excel sheet.')
    returning id into v_doc;

    insert into public.line_items
      (user_id, document_id, position, section, description, qty, unit, rate, amount) values
      (v_user, v_doc, 1, 'Single Phase T.P. Board', '12/18 Wodden Board', 1.0, 'No', 500.0, 500.0),
      (v_user, v_doc, 2, 'Single Phase T.P. Board', '32 A  Fuse cutout', 1.0, 'No', 100.0, 100.0),
      (v_user, v_doc, 3, 'Single Phase T.P. Board', '4 Pole M C B  Cover', 1.0, 'No', 100.0, 100.0),
      (v_user, v_doc, 4, 'Single Phase T.P. Board', '25 A D P Pole   M C B', 1.0, 'No', 550.0, 550.0),
      (v_user, v_doc, 5, 'Single Phase T.P. Board', '25 A  ELCB', 1.0, 'No', 1950.0, 1950.0),
      (v_user, v_doc, 6, 'Single Phase T.P. Board', '15 A  Switch/ Socket With Box', 1.0, 'No', 350.0, 350.0),
      (v_user, v_doc, 7, 'Single Phase T.P. Board', '3+2  Gang Box', 1.0, 'No', 60.0, 60.0),
      (v_user, v_doc, 8, 'Single Phase T.P. Board', 'Lisha Switch', 3.0, 'No', 30.0, 90.0),
      (v_user, v_doc, 9, 'Single Phase T.P. Board', 'Lisha 2x1  Socket', 2.0, 'No', 50.0, 100.0),
      (v_user, v_doc, 10, 'Single Phase T.P. Board', 'Angular Holder', 1.0, 'No', 45.0, 45.0),
      (v_user, v_doc, 11, 'Single Phase T.P. Board', 'Tape Role', 4.0, 'No', 22.0, 88.0),
      (v_user, v_doc, 12, 'Single Phase T.P. Board', '4 Sqmm Copper Wire', 5.0, 'Met', 55.0, 275.0),
      (v_user, v_doc, 13, 'Single Phase T.P. Board', '1 Sqmm Copper Wire', 5.0, 'Met', 20.0, 100.0),
      (v_user, v_doc, 14, 'Single Phase T.P. Board', '1"  P OP  Screw', 1.0, 'Doz', 15.0, 15.0),
      (v_user, v_doc, 15, 'Single Phase T.P. Board', '32 A  Open Type D P', 1.0, 'No', 250.0, 250.0),
      (v_user, v_doc, 16, 'Single Phase T.P. Board', 'T P Board  Fixing', 1.0, 'Lump', 1000.0, 1000.0),
      (v_user, v_doc, 17, 'Power Supply Deposit', 'Meter Cost [Refundable]', 1.0, 'Lump', 8000.0, 8000.0),
      (v_user, v_doc, 18, 'Power Supply Deposit', 'Deposit  [Currency]', 1.0, 'Lump', 8000.0, 8000.0),
      (v_user, v_doc, 19, 'Power Supply Deposit', 'Paper Charges', 1.0, 'Lump', 500.0, 500.0),
      (v_user, v_doc, 20, 'Power Supply Deposit', 'Office Expence', 1.0, 'Lump', 3500.0, 3500.0),
      (v_user, v_doc, 21, 'Power Supply Deposit', 'Contracter Charges', 1.0, 'Lump', 1500.0, 1500.0);

    insert into public.payments (user_id, document_id, paid_on, amount, method, notes)
    values (v_user, v_doc, '2022-02-27', 27073.0, 'Cash', 'Imported — settled.');
  end if;

  -- ---------- Kumar Sudrashen · 2022-10-22 · 17 lines · Rs 7,121.50 ----------
  if not exists (select 1 from public.documents where user_id = v_user and serial_no = 'INV-2022-002') then
    select id into v_client from public.clients where user_id = v_user and name = 'Kumar Sudrashen';
    if v_client is null then
      insert into public.clients (user_id, name, address)
      values (v_user, 'Kumar Sudrashen', 'Bangalore') returning id into v_client;
    end if;

    insert into public.documents
      (user_id, type, serial_no, doc_date, client_id, site_job, status,
       subtotal, taxable_value, total, amount_received, notes)
    values (v_user, 'invoice', 'INV-2022-002', '2022-10-22', v_client,
       'Single phase T.P. board material', 'paid', 7121.5, 7121.5, 7121.5, 7121.5,
       'Imported from his own Excel sheet.')
    returning id into v_doc;

    insert into public.line_items
      (user_id, document_id, position, section, description, qty, unit, rate, amount) values
      (v_user, v_doc, 1, '', '20/12 Wodden Board', 1.0, 'No', 450.0, 450.0),
      (v_user, v_doc, 2, '', '32 A  Fuse cutout', 1.0, 'No', 75.0, 75.0),
      (v_user, v_doc, 3, '', '4 Pole M C B  Cover', 1.0, 'No', 90.0, 90.0),
      (v_user, v_doc, 4, '', '25 A  D P  M C B', 1.0, 'No', 450.0, 450.0),
      (v_user, v_doc, 5, '', '25 A 2 Pole ELCB', 1.0, 'No', 1900.0, 1900.0),
      (v_user, v_doc, 6, '', '15 A  Switch/ Socket With Box', 1.0, 'No', 250.0, 250.0),
      (v_user, v_doc, 7, '', '3+2  Gang Box', 1.0, 'No', 65.0, 65.0),
      (v_user, v_doc, 8, '', 'Lisha Switch', 3.0, 'No', 30.0, 90.0),
      (v_user, v_doc, 9, '', 'Lisha 2x1  Socket', 2.0, 'No', 65.0, 130.0),
      (v_user, v_doc, 10, '', 'Angular Holder', 1.0, 'No', 45.0, 45.0),
      (v_user, v_doc, 11, '', 'Tape Role', 2.0, 'No', 22.0, 44.0),
      (v_user, v_doc, 12, '', 'Break Insulater', 2.0, 'No', 20.0, 40.0),
      (v_user, v_doc, 13, '', '16 SWG  G I   Wire', 0.25, 'Kg', 150.0, 37.5),
      (v_user, v_doc, 14, '', '4 Sqmm Copper Wire', 4.0, 'Met', 60.0, 240.0),
      (v_user, v_doc, 15, '', '1 Sqmm Copper Wire', 3.0, 'Met', 25.0, 75.0),
      (v_user, v_doc, 16, '', '1"  P OP  Screw', 1.0, 'Doz', 15.0, 15.0),
      (v_user, v_doc, 17, '', '10/2  U G  Cable', 25.0, 'Met', 125.0, 3125.0);

    insert into public.payments (user_id, document_id, paid_on, amount, method, notes)
    values (v_user, v_doc, '2022-10-22', 7121.5, 'Cash', 'Imported — settled.');
  end if;

  -- ---------- Prasana Jayaram · 2017-04-02 · 30 lines · Rs 384,250.00 ----------
  if not exists (select 1 from public.documents where user_id = v_user and serial_no = 'EST-2017-001') then
    select id into v_client from public.clients where user_id = v_user and name = 'Prasana Jayaram';
    if v_client is null then
      insert into public.clients (user_id, name, address)
      values (v_user, 'Prasana Jayaram', 'Bangalore') returning id into v_client;
    end if;

    insert into public.documents
      (user_id, type, serial_no, doc_date, client_id, site_job, status,
       subtotal, taxable_value, total, amount_received, notes)
    values (v_user, 'estimate', 'EST-2017-001', '2017-04-02', v_client,
       'Electrical estimation / quotation', 'approved', 384250.0, 384250.0, 384250.0, 0,
       'Imported from his own Excel sheet.')
    returning id into v_doc;

    insert into public.line_items
      (user_id, document_id, position, section, description, qty, unit, rate, amount) values
      (v_user, v_doc, 1, '', 'Light   point', 85.0, 'No', 550.0, 46750.0),
      (v_user, v_doc, 2, '', 'Fan  point', 11.0, 'No', 1050.0, 11550.0),
      (v_user, v_doc, 3, '', '2  Way  light  point', 7.0, 'No', 750.0, 5250.0),
      (v_user, v_doc, 4, '', 'Plug  point', 60.0, 'No', 550.0, 33000.0),
      (v_user, v_doc, 5, '', 'Lighting  circuit /  Feet', 1200.0, 'Feet', 42.0, 50400.0),
      (v_user, v_doc, 6, '', 'Heating  point', 15.0, 'No', 700.0, 10500.0),
      (v_user, v_doc, 7, '', 'Heating   circuit /  feet', 900.0, 'No', 55.0, 49500.0),
      (v_user, v_doc, 8, '', 'Calling  bell  point', 1.0, 'No', 650.0, 650.0),
      (v_user, v_doc, 9, '', 'Speaker  point', 4.0, 'No', 450.0, 1800.0),
      (v_user, v_doc, 10, '', 'Telephone   point', 8.0, 'No', 450.0, 3600.0),
      (v_user, v_doc, 11, '', 'Antena  point', 6.0, 'No', 450.0, 2700.0),
      (v_user, v_doc, 12, '', 'Speaker  circuit  /Feet', 100.0, 'Feet', 25.0, 2500.0),
      (v_user, v_doc, 13, '', 'Telephone  circuit  /Feet', 500.0, 'Feet', 25.0, 12500.0),
      (v_user, v_doc, 14, '', 'Antena   circuit  /Feet', 500.0, 'Feet', 30.0, 15000.0),
      (v_user, v_doc, 15, '', 'Main  board   D   B  box  fixing', 2.0, 'No', 14000.0, 28000.0),
      (v_user, v_doc, 16, '', 'Main Circuit From Meter Board', 100.0, 'Feet', 200.0, 20000.0),
      (v_user, v_doc, 17, '', 'Meter  board  / 3 phase meter', 1.0, 'No', 10000.0, 10000.0),
      (v_user, v_doc, 18, '', 'Pipe  with  U.G   cable /  feet', 60.0, 'Feet', 160.0, 9600.0),
      (v_user, v_doc, 19, '', 'Potted', 1.0, 'No', 500.0, 500.0),
      (v_user, v_doc, 20, '', 'Grounding  /feet', 16.0, 'No', 600.0, 9600.0),
      (v_user, v_doc, 21, '', 'Data Point', 7.0, 'No', 650.0, 4550.0),
      (v_user, v_doc, 22, '', 'Data Circuit', 400.0, 'Feet', 40.0, 16000.0),
      (v_user, v_doc, 23, '', 'C C Camara Point', 4.0, 'No', 400.0, 1600.0),
      (v_user, v_doc, 24, '', 'C C Camara Circuit', 200.0, 'Feet', 35.0, 7000.0),
      (v_user, v_doc, 25, '', 'Motar Point', 2.0, 'No', 1000.0, 2000.0),
      (v_user, v_doc, 26, '', 'Motar Circuit', 200.0, 'Feet', 60.0, 12000.0),
      (v_user, v_doc, 27, '', 'Gate light', 4.0, 'No', 400.0, 1600.0),
      (v_user, v_doc, 28, '', 'Garden Light', 2.0, 'Set', 1500.0, 3000.0),
      (v_user, v_doc, 29, '', 'Garden Light/ Gate Light Cable', 120.0, 'Feet', 80.0, 9600.0),
      (v_user, v_doc, 30, '', 'Waterleval Control Circuit', 100.0, 'Feet', 35.0, 3500.0);
  end if;

end $$;

-- Check: five bills, oldest first.
select serial_no, doc_date, status, total,
       (select count(*) from public.line_items l where l.document_id = d.id) as lines
  from public.documents d
 where notes = 'Imported from his own Excel sheet.'
 order by doc_date;
