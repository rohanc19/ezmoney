-- =============================================================
-- EzMoney — his own rate card, lifted from two years of his bills
--
-- Built from 22 of his Excel bills (Jul 2024 – Jun 2026). Each row is
-- the LATEST rate he actually charged for that thing, so the list is
-- what he charges today, not an average of history.
--
-- Work rates come from the price list he gives customers (light point,
-- fan point, circuit per foot). Materials come from the priced lines on
-- his cash bills and estimates.
--
-- HOW TO RUN: paste into the Supabase SQL Editor and run once. It
-- attaches to the FIRST user in auth.users, and re-running only updates
-- rates rather than duplicating rows.
-- =============================================================

do $$
declare
  v_user uuid;
begin
  select id into v_user from auth.users order by created_at limit 1;
  if v_user is null then
    raise exception 'No user found. Create the login first, then re-run.';
  end if;

  insert into public.rate_card_items
    (user_id, description, unit, rate, category, times_used, last_used_at)
  values
    (v_user, 'Antenna circuit per foot', 'Ft', 40.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Antenna point', 'Nos', 150.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Calling bell fitting', 'Nos', 50.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Calling bell point', 'Nos', 250.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Chandelier small fitting', 'Nos', 800.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Exhaust Fan Fitting', 'Nos', 100.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Fan fitting', 'Nos', 300.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Fan point', 'Nos', 250.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Fancy wall fitting', 'Nos', 150.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'GI pipe with UG cable per foot', 'Ft', 75.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Grounding', 'Nos', 750.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Heating circuit per foot', 'Ft', 50.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Heating point', 'Nos', 450.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Lighting circuit per foot', 'Ft', 40.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Main board DB box fixing', 'Nos', 2500.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Meter board fixing', 'Nos', 1500.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Pipe with UG cable per foot', 'Ft', 75.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Plug point', 'Nos', 175.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Potted', 'Nos', 500.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Light point', 'Nos', 175.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Speaker circuit per foot', 'Ft', 35.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Speaker point', 'Nos', 150.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Telephone circuit per foot', 'Ft', 35.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Telephone point', 'Nos', 150.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Tube light fitting', 'Nos', 100.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Underground cable per foot', 'Ft', 60.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, '2 Way fan point', 'Nos', 300.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, '2 Way light point', 'Nos', 200.0, 'Work', 1, '2024-11-08'::timestamptz),
    (v_user, 'Tape Role', 'Nos', 25.0, 'Material', 5, '2025-09-01'::timestamptz),
    (v_user, '4 Pole MCB', 'Nos', 2035.0, 'Material', 4, '2025-05-29'::timestamptz),
    (v_user, 'POP Screw', 'Doz', 20.0, 'Material', 4, '2026-06-29'::timestamptz),
    (v_user, '1 Sqmm Copper Wire', 'Mtr', 30.0, 'Material', 3, '2025-09-01'::timestamptz),
    (v_user, '1.5 Sqmm Copper Wire', 'Mtr', 45.0, 'Material', 3, '2026-06-29'::timestamptz),
    (v_user, '3/4" Bend', 'Doz', 120.0, 'Material', 3, '2026-06-29'::timestamptz),
    (v_user, '4 sqmm Copper Wire', 'Mtr', 80.0, 'Material', 3, '2025-09-01'::timestamptz),
    (v_user, 'Coach Screw', 'Nos', 22.0, 'Material', 3, '2025-05-29'::timestamptz),
    (v_user, 'DP MCB', 'Nos', 660.0, 'Material', 3, '2025-05-29'::timestamptz),
    (v_user, 'Phase Meter', 'Nos', 27500.0, 'Material', 3, '2025-05-29'::timestamptz),
    (v_user, '10 A Socket', 'Nos', 125.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '10 A Switch', 'Nos', 50.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '10 Swg Copper Wire', 'Kg', 1300.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, '12 Way DB Box', 'Nos', 2200.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '1Feet/1Feet Copper Plate', 'Nos', 2800.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, '2 Module Plate', 'Nos', 90.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '2" PVC Pipe', 'Length', 880.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, '2.5 Sqmm Copper Wire', 'Coil', 3200.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '20 A Socket', 'Nos', 250.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '20 A Switch', 'Nos', 200.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '25 A DP MCB', 'Nos', 800.0, 'Material', 2, '2025-09-01'::timestamptz),
    (v_user, '25 Sqmm Hole type Lugs', 'Nos', 66.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, '25 Sqmm Potted', 'Nos', 660.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, '3/4" C Clamp', 'Doz', 60.0, 'Material', 2, '2026-06-29'::timestamptz),
    (v_user, '3/4" Elbow', 'Nos', 8.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '3/4" PVC Junction Box', 'Nos', 40.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '32 A Fuse cutout Set', 'Nos', 1980.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, '4 Feet GI Pipe', 'Nos', 440.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, '8 Feet GI pipe', 'Nos', 880.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, '8 Module Plate', 'Nos', 220.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, '8 Module PVC Box', 'Nos', 190.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, 'Bale Patti', 'Nos', 110.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, 'Brass Bolt & Nut', 'Nos', 125.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, 'Charcoal', 'Bag', 450.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, 'Checkey', 'Nos', 10.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, 'Holder', 'Nos', 50.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, 'Salt', 'Kg', 18.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, 'Sensor Unit', 'Nos', 500.0, 'Material', 2, '2026-03-04'::timestamptz),
    (v_user, 'SP MCB', 'Nos', 200.0, 'Material', 2, '2025-06-01'::timestamptz),
    (v_user, 'Sqmm Copper Wire', 'Mtr', 65.0, 'Material', 2, '2024-07-26'::timestamptz),
    (v_user, 'Sump Auto Level control', 'Nos', 4500.0, 'Material', 2, '2026-03-04'::timestamptz),
    (v_user, 'Tube Level Pipe', 'Mtr', 20.0, 'Material', 2, '2025-05-29'::timestamptz),
    (v_user, '00 114663.00 114663 . 00 UG Cable 34 25 Sqmm UG cable', 'Mtr', 260.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '1 Feet Tag', 'Nos', 2.5, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, '1" Bend', 'Doz', 120.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '1" Collar', 'Doz', 96.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '1" PVC Junction Box', 'Nos', 50.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '1" PVC Pipe', 'Nos', 85.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '1" Saddle', 'Box', 576.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '10 MFD Capacitor', 'Nos', 225.0, 'Material', 1, '2025-07-22'::timestamptz),
    (v_user, '12 Module Plate', 'Nos', 300.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '15 A Lisha Plug', 'Nos', 100.0, 'Material', 1, '2025-06-04'::timestamptz),
    (v_user, '2 Core 2.5Sqmm Copper Wir e', 'Mtr', 150.0, 'Material', 1, '2025-09-01'::timestamptz),
    (v_user, '2 Module PVC Box', 'Nos', 75.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, '2 Module Roma Plate', 'Nos', 75.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, '2 Pin Plug', 'Nos', 20.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, '2 Pole MCB', 'Nos', 650.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, '20 A Roma 2x1 Socket', 'Nos', 225.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, '20 W LED Tube Set', 'Nos', 350.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, '3/4" C Clamp Double Nile 6 400 432.00 2592.00 7 Gatta', 'Nos', 2.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, '3/4" Collar', 'Doz', 84.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, '3/4" Flexible', 'Mtr', 20.0, 'Material', 1, '2025-09-01'::timestamptz),
    (v_user, '3/4" Flexible Pipe', 'Role', 500.0, 'Material', 1, '2025-09-01'::timestamptz),
    (v_user, '3/4" Junction Box', 'Nos', 40.0, 'Material', 1, '2026-06-29'::timestamptz),
    (v_user, '3/4" PVC Pipe', 'Nos', 80.0, 'Material', 1, '2026-06-29'::timestamptz),
    (v_user, '3/4" Saddle', 'Box', 432.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '32 A Fuse Cutout', 'Nos', 200.0, 'Material', 1, '2025-09-01'::timestamptz),
    (v_user, '32A DP MCB', 'Nos', 1000.0, 'Material', 1, '2025-09-01'::timestamptz),
    (v_user, '36 W LED Metal Body Tube set', 'Nos', 1100.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, '4 Module Plate', 'Nos', 160.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '4 Module PVC Box', 'Nos', 140.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, '4 Module Roma Plate', 'Nos', 110.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, '5" Flexible Pipe', 'Role', 400.0, 'Material', 1, '2025-09-01'::timestamptz),
    (v_user, '6 Module Plate', 'Nos', 160.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, '6 Module PVC Box', 'Nos', 140.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, '9 W LE DBulb', 'Nos', 110.0, 'Material', 1, '2026-06-29'::timestamptz),
    (v_user, 'Blank Switch', 'Nos', 22.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, 'Bolt & Nut', 'Nos', 10.0, 'Material', 1, '2025-09-01'::timestamptz),
    (v_user, 'Bulkhead Fitting', 'Nos', 550.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, 'CASH BILL 7 20 A Roma 2x1 Socket', 'Nos', 225.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, 'Checkey 20 No 10 . 00 200 . 00 31 Round Block', 'Nos', 20.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, 'dl 24 2 Module PVC Box', 'Nos', 95.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, 'e Date:26/7/2024 Sub : Electrical Wor k 1 3/4 " PVC Pipe', 'Nos', 60.0, 'Material', 1, '2024-07-26'::timestamptz),
    (v_user, 'e t Li g ht Fitti ng 1 No 3500 . 00 3500 . 00 4 Bend Rod', 'Nos', 400.0, 'Material', 1, '2026-06-29'::timestamptz),
    (v_user, 'Electrical Wor k Estimation UG Cable 1 25 Sqmm UG cable', 'Mtr', 295.0, 'Material', 1, '2025-05-29'::timestamptz),
    (v_user, 'Estimation 4 end 5 o 0.00 600.00 5 3/4" Collar', 'Doz', 84.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, 'F M Radio Transformer', 'Nos', 400.0, 'Material', 1, '2024-07-26'::timestamptz),
    (v_user, 'Fuse Cutout Lugs', 'Nos', 3.0, 'Material', 1, '2025-09-01'::timestamptz),
    (v_user, 'Fuse cutout Set', 'Nos', 1950.0, 'Material', 1, '2025-05-29'::timestamptz),
    (v_user, 'Gatta', 'Doz', 20.0, 'Material', 1, '2026-06-29'::timestamptz),
    (v_user, 'Glass Bulkhead Water Proof Fittin g', 'Nos', 1400.0, 'Material', 1, '2026-06-29'::timestamptz),
    (v_user, 'Glass Bulkhead Water Proof Fitting', 'Nos', 1400.0, 'Material', 1, '2026-06-29'::timestamptz),
    (v_user, 'Gt t 500 N 20 0 1000 00 11 Gatta', 'Nos', 2.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, 'harges 5500.00 5500.00 36443.00 Earthing 1 4Feet GI Pipe', 'Nos', 440.0, 'Material', 1, '2025-05-29'::timestamptz),
    (v_user, 'harges 5500.00 5500.00 38393.00 Earthing 1 4Feet GI Pipe', 'Nos', 440.0, 'Material', 1, '2025-05-29'::timestamptz),
    (v_user, 'Impeller Brass', 'Nos', 400.0, 'Material', 1, '2025-07-22'::timestamptz),
    (v_user, 'Lathe Work 600.00 600.00 5 2.5" Bolt/ Washer', 'Nos', 20.0, 'Material', 1, '2025-07-22'::timestamptz),
    (v_user, 'LED Tube Light Set 20 W', 'Nos', 350.0, 'Material', 1, '2026-06-29'::timestamptz),
    (v_user, 'Lisha 2 Way Switch', 'Nos', 110.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, 'Lisha Fan Regulator', 'Nos', 480.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, 'Lugs', 'Nos', 3.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, 'MCB Lugs', 'Nos', 5.0, 'Material', 1, '2025-09-01'::timestamptz),
    (v_user, 'ontractor and Supervisor Internal Wiring 1 3/4" PVC Pipe', 'Nos', 65.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, 'Roma Switch', 'Nos', 50.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, 'Rubber Gasket', 'Nos', 50.0, 'Material', 1, '2025-07-22'::timestamptz),
    (v_user, 'Show Light Holder', 'Nos', 150.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, 'Spring Role', 'Nos', 280.0, 'Material', 1, '2025-06-01'::timestamptz),
    (v_user, 'Supervisor S u b : El ec t r i ca l W or k 1 LED Driver', 'Nos', 400.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, 'Ta p e Role', 'Nos', 25.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, 'Tape Role 15 No 25 . 00 375 . 00 18 12 Module PVC Box', 'Nos', 250.0, 'Material', 1, '2025-02-14'::timestamptz),
    (v_user, 'Thread Type Bulb', 'Nos', 180.0, 'Material', 1, '2024-12-26'::timestamptz),
    (v_user, 'Tube Light Adapter', 'Nos', 45.0, 'Material', 1, '2025-06-01'::timestamptz)
  on conflict (user_id, description) do update
    set rate = excluded.rate,
        unit = excluded.unit,
        category = excluded.category;
end $$;

-- Check: should be about 140 rows, split Work / Material.
select category, count(*) as items, min(rate) as cheapest, max(rate) as dearest
from public.rate_card_items group by category order by category;
