// The demo copy: same code, its own database, sample data, shown to
// people who are curious what this is. DEMO_MODE=1 is set only on that
// Vercel project, never on his, so nothing here changes his app.
//
// What it turns off is what belongs to him alone — his signature, and
// the screens that only make sense for an electrician with men on a
// daily wage (Today, Labour, the points sheet).
//
// Server-only: no NEXT_PUBLIC_, so it is read at render and costs the
// browser nothing.
export const IS_DEMO = process.env.DEMO_MODE === "1";
