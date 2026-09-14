// Spelling help for what gets printed on a customer's copy.
//
// Two years of his bills carry the same handful of slips — "colar" for
// collar, "modal" for module, "Grue" for groove, "Labor" for labour — and
// they print in the biggest column on the page. This proposes the fix; it
// never applies one on its own. He taps to accept, or ignores it.
//
// The rule for what may go in here: only a word we are sure about. His
// trade has its own vocabulary — gatta, patti, potted, niles, checkey are
// words on a Bangalore electrical bill, not mistakes — and "correcting"
// one of those would make the bill worse than the typo did. Anything
// uncertain is left alone deliberately.

/** Whole words, matched case-insensitively, replaced with this casing. */
const WORDS: Record<string, string> = {
  // things
  colar: "Collar",
  collor: "Collar",
  modal: "Module",
  grue: "Groove",
  batton: "Batten",
  angalur: "Angular",
  sencer: "Sensor",
  censer: "Sensor",
  censor: "Sensor",
  cealing: "Ceiling",
  ceeling: "Ceiling",
  regulater: "Regulator",
  adoptor: "Adaptor",
  ligrand: "Legrand",
  coatch: "Coach",
  sleaves: "Sleeves",
  geaser: "Geyser",
  geyzer: "Geyser",
  leter: "Litre",
  liter: "Litre",
  ketal: "Kettle",
  kettel: "Kettle",
  role: "Roll",
  colling: "Calling",
  swich: "Switch",
  // work
  labor: "Labour",
  sevicing: "Servicing",
  servising: "Servicing",
  altration: "Alteration",
  wireing: "Wiring",
  fiting: "Fitting",
  fittting: "Fitting",
};

/**
 * Trade acronyms. These are the exception to following his capitalisation
 * — "40 A DP Mcb" wants MCB whether or not the rest of the line is
 * capitalised, because MCB is not a word.
 */
const ACRONYMS: Record<string, string> = {
  mcb: "MCB",
  mccb: "MCCB",
  elcb: "ELCB",
  rccb: "RCCB",
  pvc: "PVC",
  led: "LED",
  ups: "UPS",
  mfd: "MFD",
  ug: "UG",
  gi: "GI",
  db: "DB",
  dp: "DP",
  sp: "SP",
  pop: "POP",
};

/**
 * Words that look wrong and are not. His trade's own vocabulary, plus
 * brand names. Nothing here is ever touched, by any rule below.
 */
const TRADE_WORDS = new Set([
  "gatta",
  "patti",
  "bale",
  "potted",
  "niles",
  "nile",
  "checkey",
  "swg",
  "sqmm",
  "lisha",
  "roma",
  "deco",
  "crompton",
  "anchor",
  "bescom",
  "lugs",
  "elbow",
  "saddle",
  "casing",
  "impeller",
  "charcoal",
]);

/**
 * Whole phrases, matched case-insensitively on the trimmed string. These
 * are the ones a word-by-word pass cannot reach — two words run together,
 * or a letter that drifted away from its word.
 */
const PHRASES: Record<string, string> = {
  "3/4inchpipe": '3/4" PVC Pipe',
  "3/4inch colar": '3/4" Collar',
  "3/4 inch colar": '3/4" Collar',
  "2inch ss niles": '2" SS Niles',
  "2 inch ss niles": '2" SS Niles',
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

/**
 * Acronyms he spells out letter by letter. Listed rather than detected:
 * a rule that joins any run of single letters turns "15 W L E D Bulb"
 * into "15 WLED Bulb", because the W is a unit and not part of the word.
 */
const SPACED_ACRONYMS: [RegExp, string][] = [
  [/\bL\s+E\s+D\b/gi, "LED"],
  [/\bP\s+V\s+C\b/gi, "PVC"],
  [/\bU\s+P\s+S\b/gi, "UPS"],
  [/\bP\s+O\s+P\b/gi, "POP"],
  [/\bM\s+C\s+B\b/gi, "MCB"],
  [/\bE\s+L\s+C\s+B\b/gi, "ELCB"],
  [/\bF\s+M\b/gi, "FM"],
  [/\bR\s+J\s+(\d)/gi, "RJ$1"],
  [/\bD\s+B\b/gi, "DB"],
  [/\bG\s+I\b/gi, "GI"],
];

/** Tidy spacing: repeated spaces, a space before a comma, stray ends. */
function tidySpacing(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .replace(/\s*"\s*/g, '" ')
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,\s]+$/, "");
}

/**
 * The tidied form of `input`, or null when there is nothing to propose.
 * Never mutates anything — the caller decides whether to offer it, and
 * the user decides whether to take it.
 */
export function suggest(input: string): string | null {
  const original = input ?? "";
  if (!original.trim()) return null;

  const phrase = PHRASES[tidySpacing(original).toLowerCase()];
  let out = phrase ?? original;

  if (!phrase) {
    for (const [re, to] of SPACED_ACRONYMS) out = out.replace(re, to);

    // An ampersand glued to the word after it: "Labor &servicing".
    out = out.replace(/&(?=[A-Za-z])/g, "& ");

    // A number glued to the word after it: "2inch", "1Feet". Letters only,
    // two or more, so "2x1" and "20W" are left as he wrote them.
    out = out.replace(/(\d)([A-Za-z]{3,})/g, (m, d, word) =>
      TRADE_WORDS.has(word.toLowerCase()) ? m : `${d} ${word}`
    );

    out = out.replace(/[A-Za-z]+/g, (word) => {
      const lower = word.toLowerCase();
      if (TRADE_WORDS.has(lower)) return word;
      const acronym = ACRONYMS[lower];
      if (acronym) return acronym;
      const fixed = WORDS[lower];
      if (!fixed) return word;
      // "Module" for "modal" but "module" for "modal" mid-sentence: keep
      // his own capitalisation when the word he typed was lower case.
      return word[0] === word[0].toLowerCase() && word === lower
        ? fixed.toLowerCase()
        : fixed;
    });
  }

  out = tidySpacing(out);
  return out && out !== original ? out : null;
}

/** How many of these need a look — for the banner on My Items & Rates. */
export function countSuggestions(texts: string[]): number {
  return texts.reduce((n, s) => (suggest(s) ? n + 1 : n), 0);
}
