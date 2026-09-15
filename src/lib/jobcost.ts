// What a job actually cost him, and what was left.
//
// The app measured his revenue for a year and never his costs, so the
// Summary reported revenue minus labour and called it profit. Two thirds
// of what he bills is material he had to buy first, so that figure was
// about three times too flattering. Everything here exists to stop the
// app saying a number it cannot support.
//
// Two different questions, deliberately kept apart:
//
//   margin  — billed minus what the job consumed. Labour costed at the
//             days worked, not at what he happened to hand over that
//             week, because a man paid late still worked.
//   cash    — money in minus money out, over a period. What his bank
//             balance did.
//
// A job is profitable and still leave him short of cash; both readings
// are true and neither substitutes for the other.

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface JobCost {
  billed: number;
  /** Shop lists priced up, plus any expense tagged to the client. */
  materials: number;
  /** Days worked on this client's sites, at the rate they were worked at. */
  labour: number;
  /** billed - materials - labour. Null when nothing was billed. */
  margin: number | null;
  /** margin as a share of billed, 0-1. Null when nothing was billed. */
  marginRate: number | null;
  /** False when no cost has been recorded at all — say nothing, not zero. */
  costed: boolean;
}

export function jobCost(input: {
  billed: number;
  materials: number;
  labour: number;
}): JobCost {
  const billed = round2(input.billed);
  const materials = round2(input.materials);
  const labour = round2(input.labour);
  const costed = materials > 0 || labour > 0;
  const margin = billed > 0 ? round2(billed - materials - labour) : null;
  return {
    billed,
    materials,
    labour,
    margin,
    marginRate: billed > 0 && margin !== null ? margin / billed : null,
    costed,
  };
}

/**
 * Whether a margin is worth showing. With materials unrecorded, "profit"
 * is just revenue minus labour, which is the lie this file exists to
 * stop — so a job with no material cost against it reports nothing.
 */
export function canShowMargin(c: JobCost): boolean {
  return c.billed > 0 && c.materials > 0;
}
