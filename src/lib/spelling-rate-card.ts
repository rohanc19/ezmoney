// The wrecks that only exist in his rate card.
//
// These are single strings from the 2024 import — a geyser whose brand
// came out as "Record", a fitting whose last letter drifted off — and he
// will never type any of them again. They live here rather than in
// `spelling.ts` because that file ships to the phone with the bill form
// and the day book, and the bill form is at the 105 kB ceiling. Nothing
// but the rate-card cleanup ever needs them.

import { suggest } from "@/lib/spelling";

const RATE_CARD_PHRASES: Record<string, string> = {
  "ding dongcolling bell": "Ding Dong Calling Bell",
  "roma20 a socket": "Roma 20 A Socket",
  "9 w le dbulb": "9 W LED Bulb",
  "glass bulkhead water proof fittin g": "Glass Bulkhead Water Proof Fitting",
  "2 core 2.5sqmm copper wir e": "2 Core 2.5 Sqmm Copper Wire",
  "p o p  screw": "POP Screw",
  "p o p screw": "POP Screw",
  "iron box sevicing": "Iron Box Servicing",
  "record 25 leter geaser": "Racold 25 Litre Geyser",
};

/** `suggest`, plus the one-off strings only his saved list contains. */
export function suggestForRateCard(input: string): string | null {
  return suggest(input, RATE_CARD_PHRASES);
}
