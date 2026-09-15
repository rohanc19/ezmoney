# -*- coding: utf-8 -*-
# The 2020 Vardhaman job, repriced at his rate card today.
# Only lines where the same thing exists in both, so the totals compare.
rows = [
    # label,              qty,  unit,  2017,  2020, today
    ("Light point",        143, "No",   550,   550, 175),
    ("Fan point",           11, "No",  1050,  1100, 250),
    ("2 Way light point",   14, "No",   750,   900, 200),
    ("Plug point",         110, "No",   550,   550, 175),
    ("Lighting circuit/ft",1650,"Feet",   42,    45,  40),
    ("Heating point",       21, "No",   700,   850, 450),
    ("Heating circuit/ft", 1450,"Feet",   55,    55,  50),
    ("Antenna point",        5, "No",   450,   450, 150),
    ("Antenna circuit/ft",  700,"Feet",   30,    40,  40),
    ("Main board DB fixing",  6, "No", 14000,  4500, 2500),
    ("Pipe with UG cable/ft",75,"Feet",  160,   300,  75),
    ("Potted",               1, "No",   500,   800, 500),
    ("Telephone point",      4, "No",   450,   450, 150),
    ("Telephone circuit/ft",200,"Feet",   25,    25,  35),
]
w = max(len(r[0]) for r in rows)
t20 = t_now = 0
print(f"{'':{w}}  {'qty':>5}  {'2020 rate':>9} {'2020 ₹':>10}   {'now rate':>8} {'now ₹':>10}")
for label, qty, unit, r17, r20, rn in rows:
    a20, an = qty * r20, qty * rn
    t20 += a20; t_now += an
    print(f"{label:{w}}  {qty:>5}  {r20:>9} {a20:>10,}   {rn:>8} {an:>10,}")
print("-" * (w + 52))
print(f"{'TOTAL (these lines)':{w}}  {'':>5}  {'':>9} {t20:>10,}   {'':>8} {t_now:>10,}")
print()
print(f"Same work, at today's rates:  {t_now/t20*100:.0f}% of the 2020 price")
print(f"Difference on this one job:   Rs {t20 - t_now:,}")
