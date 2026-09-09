# EzMoney — project memory

Billing app for **Chandra Electricals** (R. Chandrashekar), a licensed electrical
contractor in Bangalore. Built and maintained by his son Rohan; the electrician is
the only user. Rohan owns the code, hosts it, and pushes updates centrally.

**Live:** https://ezmoney-phi.vercel.app · repo `github.com/rohanc19/ezmoney` (private)

---

## The user this is built for

Non-technical, works on site from a phone, and also uses an **old low-spec Windows
PC**. Every design decision below follows from that. When in doubt, choose the
option that is simpler for him, not the one that is more capable.

- **Old PC is a thin client.** Server-render everything; keep first-load JS around
  96 kB. No animation libraries, no UI component libraries, no client-side data
  fetching frameworks. Check the bundle line in `next build` output before shipping.
- **Mobile-first.** 48px minimum tap targets, single-column forms, numeric keypads
  on amount/qty fields.
- **His words, not software words.** "New Bill", "Final Invoice", "Save as PDF" —
  never "Create Document", "Entity", "Record".
- **One clear primary action per screen.** Secondary actions are visibly smaller.
- **Forgiving.** Auto-saved drafts, confirm before destructive actions,
  plain-language errors that say what to do next.
- **Status is colour + word**, never colour alone.
- **₹ currency, `dd-mmm-yyyy` dates, Indian number grouping** (lakh/crore) —
  helpers live in `src/lib/format.ts`, always use them.

## Stack

Next.js 14 App Router · TypeScript · Tailwind · Supabase (Postgres + Auth + RLS) ·
Vercel. PDFs are the browser's own print-to-PDF (`window.print()` + print CSS) —
**never add a PDF library**.

- Supabase project ref `vulktqvxxdgrbpxjxwzk`, org "Chandra E&E", **Singapore
  (ap-southeast-1)**. Vercel function region is pinned to **sin1** to match.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (both in
  `.env.local`, gitignored, and in Vercel). `GOOGLE_VISION_API_KEY` for the bill
  scanner; optional `SCAN_PROVIDER=claude` + `ANTHROPIC_API_KEY` to switch
  engines. With the Google key set and an Anthropic key also present, photos
  Google reads nothing off are retried on Claude automatically. Settings →
  Bill scanner runs a live check that names the exact fix when it fails.

## Repo map

```
supabase/migrations/0001_init.sql   tables, RLS, next_serial()
supabase/migrations/0002_v2.sql     GST columns, rate card, receipts bucket
supabase/migrations/0003_v3.sql     labour book (workers + worker_entries), service charge
supabase/migrations/0004_v4.sql     shop price book (shops + item_prices)
supabase/migrations/0005_v5.sql     part-payments (payments), client_id indexes
supabase/seed.sql                   demo data (attaches to first auth user)
src/middleware.ts                   session refresh + login redirect
src/lib/actions.ts                  every server action
src/lib/gst.ts                      tax computation (single source of truth)
src/lib/upi.ts                      UPI intent string + server-rendered QR
src/lib/payments.ts                 part-payment sums and the derived bill status
src/lib/prices.ts                   item_key normalising, cheapest-price picking
src/lib/scan/parse.ts               shop-bill text → line items
src/lib/scan/providers.ts           OCR provider abstraction
src/lib/format.ts                   ₹, Indian grouping, dd-mmm-yyyy, amount in words
src/lib/i18n.ts                     English + Kannada labels
src/app/(app)/...                   home, documents, clients, labour, shops, expenses,
                                    settings, rate-card
src/app/api/scan/route.ts           OCR endpoint
src/app/api/export/route.ts         CSV backup
public/brand/                       CE logo files
public/fonts/                       Manrope, Kannada, and the ₹ glyph fallback
```

## Things that will bite you

- **The ₹ sign is missing from fonts on his old PC.** `public/fonts/rupee-*.woff2`
  are ~700-byte fonts containing only U+20B9, wired up in `globals.css` with
  `unicode-range`. Don't remove them, and don't assume a glyph exists on his machine.
  The same applies to Kannada (`kannada-*.woff2`) and to emoji — prefer text labels
  or inline SVG over emoji in new UI.
- **Serial numbers come from Postgres, never from app code.** `next_serial(type)`
  is an atomic per-user/per-type/per-year counter. Switching to Indian financial-year
  numbering is a data change only: `business_profile.serial_year_basis = 'fiscal'`.
- **Line items are the source of truth.** Totals are recomputed from them
  (`computeTotals` in `src/lib/gst.ts`) and then persisted onto the document row.
  The print view recomputes too, so old rows can never print stale numbers.
- **GST is live.** He is registered. Intrastate → CGST+SGST; interstate → IGST,
  decided by comparing `business_profile.state_code` (Karnataka, 29) with the
  document's `place_of_supply` (taken from the client's state). Clients with no
  state set are treated as intrastate.
- **Receipt photos are in a private bucket** (`receipts`), keyed `<user_id>/...`,
  served through short-lived signed URLs. Never make that bucket public.
- **Every table carries `user_id` with an RLS policy.** Keep it that way even
  though there is one user — multi-user later should need no schema change.
- **The labour book is a ledger, not a list.** `worker_entries` rows are
  `work` (what he owes) or `payment`/`advance` (money handed over); `amount`
  always holds the rupee figure so a balance is one sum. Payments there count
  towards the year's spend on Home, so the same money must not also be entered
  as a `Labour` expense.
- **The service charge is taxed.** `computeServiceCharge` turns the mode +
  value into rupees; `computeTotals` then adds it to the taxable value and to
  the standard-rate slab. Any place that recomputes totals — the print view
  included — has to pass `serviceCharge`, or the printed TOTAL will disagree
  with the stored one.
- **Paid is derived, never clicked.** `payments` rows are the source of truth;
  `documents.amount_received` is the persisted sum and `status` follows the money
  via `derivePaymentState` in `src/lib/payments.ts`. `setDocumentStatus` refuses
  `paid` and `partly_paid` for that reason — a bill must never read Paid with no
  payment behind it. Anything that changes a document total has to re-sync.
- **Every money figure counts part-payments.** Home, the clients list and the
  client ledger all read `amount_received`, not `status = 'paid'`. A new screen
  that filters on the status instead will quietly under-report what he is owed.
- **The backup is only a backup if `TABLES` in `src/app/api/export/route.ts`
  lists every table.** Adding a table to the schema without adding it there
  silently drops it from `?what=all`, which is the one file worth keeping.
- **`itemKey` is stored, so changing it orphans the price book.** The same
  wire is written three ways on three shops' bills, so `src/lib/prices.ts`
  normalises and *sorts* the words into `item_prices.item_key`. Every match —
  search, and the hint under the bill form — goes through `matchesQuery`.
  Change the normalising and you must backfill `item_key` for every row.
- **A stale price never wins.** Prices are appended, never overwritten, and
  anything older than `STALE_DAYS` is shown greyed but is barred from being
  crowned cheapest — an old low price must not send him across town.
- **Print CSS matters as much as screen CSS.** `.no-print` hides app furniture;
  `.print-page` strips card styling. Test any invoice change with an actual
  print preview, not just on screen.

## Shipping changes

```bash
cd ~/Projects/ezmoney && npm run dev      # check locally
git add -A && git commit -m "..." && git push
```

Vercel redeploys in ~1 minute; his devices pick it up on next load. **Database
changes do not ride along with a push** — run the SQL in the Supabase SQL Editor
first, then push the code that depends on it. If a deploy breaks something, use
Vercel → Deployments → Instant Rollback rather than hot-fixing forward.

## Deliberately out of scope

Online payment integration, GST return filing, inventory/stock, multi-user teams,
offline mode. Say no and flag scope creep.
