// One man's day, shared across the sites he worked at.
//
// 10 of his first 25 work days name more than one site — "Mantri
// 601/Ravikumar BDA", "Shiva temple/sudrashen RRNagar" — and a work row
// holds one customer, so the day went untagged and labour reached no job
// margin at all. A split day is simply one work row per customer: the
// man's balance, the week and Saturday's settlement all sum amounts, so
// they cannot tell the difference, and job costing finally can.
//
// Server-only. Pure, so it can be checked without a database.

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Share = { amount: number; days: number };

/**
 * Split `amount` (and `days`) across customers.
 *
 * `typed` holds what he wrote against each customer, or null where he
 * left it to be shared out. Typed figures are taken as they are; what is
 * left of the wage is shared evenly among the rest. If he typed more than
 * the wage, that is his lump sum and it stands — the untyped get nothing
 * rather than a negative.
 *
 * Every rupee and every day is accounted for: rounding remainders go on
 * the first row, so the parts always add back to the whole — the week
 * view prints a tick only when a day's parts make exactly 1.
 */
export function splitDay(amount: number, days: number, typed: (number | null)[]): Share[] {
  const n = typed.length;
  if (n === 0) return [];

  const given = typed.map((v) => (v !== null && v > 0 ? r2(v) : null));
  const typedSum = given.reduce<number>((s, v) => s + (v ?? 0), 0);
  const open = given.filter((v) => v === null).length;
  const left = Math.max(r2(amount - typedSum), 0);

  // Even shares of what is left, the odd paisa on the first open row.
  const each = open > 0 ? Math.floor((left / open) * 100) / 100 : 0;
  let spare = open > 0 ? r2(left - each * open) : 0;
  const amounts = given.map((v) => {
    if (v !== null) return v;
    const a = r2(each + spare);
    spare = 0;
    return a;
  });

  // Days follow the money, so "half a day at Mantri" reads true.
  const total = amounts.reduce((s, a) => s + a, 0);
  const dayShares = amounts.map((a) =>
    total > 0 ? Math.floor(((days * a) / total) * 100) / 100 : Math.floor((days / n) * 100) / 100
  );
  dayShares[0] = r2(dayShares[0] + r2(days - dayShares.reduce((s, d) => s + d, 0)));

  return amounts.map((a, i) => ({ amount: a, days: dayShares[i] }));
}
