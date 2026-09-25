// The order he writes a point estimate in.
//
// Taken from his own 2-Apr-2017 sheet for Prasana Jayaram, which runs:
// light point, fan point, two-way, plug point, then the lighting circuit
// that serves them; then heating, then the low-voltage points — bell,
// speaker, telephone, antenna — with their circuits after them; then the
// boards, the incoming cable, and earthing last.
//
// That is the order a house is walked and quoted, not the order a price
// list sorts into, and sorting these by rate put "Light point" fourteenth.
//
// Items he adds later that are not named here fall to the end, so a new
// point rate appears rather than disappearing.

export const POINT_ORDER: string[] = [
  // the rooms
  "Light point",
  "Fan point",
  "2 Way fan point",
  "2 Way light point",
  "Plug point",
  "Lighting circuit per foot",
  "Heating point",
  "Heating circuit per foot",
  // the low-voltage runs
  "Calling bell point",
  "Speaker point",
  "Telephone point",
  "Antenna point",
  "Speaker circuit per foot",
  "Telephone circuit per foot",
  "Antenna circuit per foot",
  // the boards
  "Main board DB box fixing",
  "12 Way DB Box",
  "Meter board fixing",
  "U P S  Mass Pet Circuit Board",
  // what comes in from the road, and earthing
  "Pipe with UG cable per foot",
  "GI pipe with UG cable per foot",
  "Underground cable per foot",
  "Potted",
  "25 Sqmm Potted",
  "Grounding",
];

/** Where a point rate sits on his sheet. Unknown names go to the end. */
export function pointRank(description: string): number {
  const i = POINT_ORDER.indexOf(description);
  return i === -1 ? POINT_ORDER.length : i;
}

/** His rates, in the order he quotes them. */
export function inPointOrder<T extends { description: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const d = pointRank(a.description) - pointRank(b.description);
    return d !== 0 ? d : a.description.localeCompare(b.description);
  });
}
