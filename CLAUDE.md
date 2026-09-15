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
  Measured Sep 2026: 87.3 kB shared, 96.2 kB on most screens, 102 kB on the bill
  and expense forms (the three client components — DocumentForm, ScanSheet,
  RatePicker, DayItemPicker — /day is 97 kB); the bill form is at 105 kB — the due date took it to 103,
  the spelling dictionary to 105. That is the ceiling; anything past
  ~105 kB needs a reason. The lever if it ever has to come down is
  `PHRASES` in `src/lib/spelling.ts`, which only the rate-card cleanup
  really needs and which could move to a server-only module.
- **What actually costs him is paint, not bytes.** The machine renders in
  software more often than not. So: no `backdrop-filter` (it re-blurs the
  backdrop every scroll frame — it was on the nav and the total bar, and both
  are solid now), no `transform` animations on anything that wraps a page (see
  `.rise`), and be careful adding large soft `box-shadow`s to anything that
  repeats per row in a long list. Fonts are fine: 26 kB for English, and
  Kannada's 56 kB only downloads if he switches, thanks to `unicode-range`.
- **Mobile-first.** 48px minimum tap targets, single-column forms, numeric keypads
  on amount/qty fields.
- **His words, not software words.** "New Bill", "Final Invoice", "Save as PDF" —
  never "Create Document", "Entity", "Record".
- **One clear primary action per screen.** Secondary actions are visibly smaller.
- **Anything he needs occasionally is a one-line link, not a block.** The bill
  form is the screen he lives on, so parts and the service charge sit behind
  "+ Split into parts" and "+ Add a service charge" under Add Item, and only
  unfold once asked for. The totals card is hidden entirely when there is no
  breakdown to show, because the running-total bar already says the number.
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
supabase/migrations/0006_catchup.sql  idempotent repair + a check; run when anything looks wrong
supabase/migrations/0007_sections.sql line_items.section — parts of a job
supabase/migrations/0008_checklists.sql  shop checklists (checklists + checklist_items)
supabase/migrations/0009_invoice_format.sql  due date, client PAN, bank branch, terms block
supabase/migrations/0010_job_costs.sql  by-client indexes for job costing
supabase/migrations/0011_day_prices.sql  expense shop/qty/unit; prices from the day book
supabase/checklist_templates_seed.sql    his six section templates, from his notepad
supabase/seed.sql                   demo data (attaches to first auth user)
supabase/rate_card_seed.sql         his real rates, lifted from 22 of his old Excel bills
supabase/rate_card_junk_cleanup.sql  the four rows in his list that are not items
supabase/merge_gopinath.sql         one customer, entered twice with a different capital R
supabase/role_to_roll.sql           the unit "Role" -> "Roll" (run any time)
src/middleware.ts                   session refresh + login redirect
src/lib/actions.ts                  every server action
src/lib/gst.ts                      tax computation (single source of truth)
src/lib/upi.ts                      UPI intent string + server-rendered QR
src/lib/payments.ts                 part-payment sums and the derived bill status
src/lib/share.ts                    the mailto: body for a bill
src/lib/prices.ts                   item_key normalising, cheapest-price picking
src/lib/spelling.ts                 proposed spelling fixes for what gets printed
src/lib/jobcost.ts                  what a job cost and what it left
src/lib/summary.ts                  days-to-settle, job-size buckets, month series
src/lib/scan/parse.ts               shop-bill text → line items
src/lib/scan/providers.ts           OCR provider abstraction
src/lib/format.ts                   ₹, Indian grouping, dd-mmm-yyyy, amount in words
src/lib/i18n.ts                     English + Kannada labels
src/app/(app)/...                   home (the client list), day, documents, clients,
                                    labour, shops, expenses, summary, settings, rate-card
src/app/api/scan/route.ts           OCR endpoint
src/app/api/export/route.ts         CSV backup
public/brand/                       CE logo files
public/fonts/                       Manrope, Kannada, and the ₹ glyph fallback
```

## Things that will bite you

- **`UNITS` is ordered by what he actually writes, not alphabetically.** Two
  years of his bills are almost all `Nos`, then metres of wire, then points,
  then dozens and coils — so those sit at the top of a dropdown he scrolls on
  a phone. `Hrs`, `Day`, `Job` and `Lump` never appeared once in 22 documents
  and sit at the bottom. Never remove a unit: the string is stored on every
  line item, and a value missing from the list renders as a blank select.
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
- **Server actions default their dates with `todayISO()`, not
  `toISOString()`.** Nine actions used the latter — a bill, an expense, a
  day of work, a payment, a shop price and a shop list all defaulted to
  the UTC date, so anything entered after half past five in the evening
  IST was filed under the previous day. `todayISO` reads the date in IST.
- **Never build a yyyy-mm-dd with `toISOString()`.** It converts to UTC,
  and midnight in Bangalore is half past six the previous evening in UTC,
  so every calendar date silently moves back a day — which turned the
  Monday of the working week into a Sunday and put a recorded day of work
  outside the week it belonged to. `localISO` in `src/lib/format.ts` reads
  the date in local time; `mondayOf` and `addDays` go through it.
- **The working week runs Monday to Saturday and settles on Saturday.**
  His men are on a daily wage, take advances during the week, and are paid
  the balance on Saturday. The worker page is that week; a day cell opens
  `/labour/[id]/day/[date]`, which holds everything about one man on one
  day — where he worked, what he took as an advance, what he was paid.
  There is deliberately no ledger list on the worker page: the week gives
  the shape and the day gives the detail, so a flat list of every entry
  ever was just noise in between. The day itself is one table — what,
  where, how much — because three card sections for work, advances and
  payments read as three screens stacked rather than one day.
- **Never print "1 day x Rs 1,200" next to Rs 600.** He often types a lump
  sum over a row that still carries days and rate, so the day table shows
  the multiplication only when it actually produces the amount, and the
  day count alone when it does not. A sum that disagrees with the figure
  beside it is worse than no sum.
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
- **A half-applied migration is worse than none.** 0005 once landed the
  `payments` table without `documents.amount_received`, so every money query
  errored and Home showed ₹0 with no error anywhere. `0006_catchup.sql` is
  idempotent and ends with a check that must print "yes" on every column —
  run it whenever the numbers look wrong before debugging any code.
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
- **A bill is settled by the instalment that finally covers it.** Not the
  first one — an advance on day 1 and the balance on day 60 is a sixty-day
  customer. `daysToSettle` returns null while anything is still owed, so a
  half-paid invoice never flatters "pays in about N days".
- **Charts are inline SVG, never a library.** The month bars on `/summary`
  are twelve `<rect>`s, server-rendered, zero JavaScript.
- **A stale price never wins.** Prices are appended, never overwritten, and
  anything older than `STALE_DAYS` is shown greyed but is barred from being
  crowned cheapest — an old low price must not send him across town.
- **`mailto:` cannot attach a file.** The email body therefore carries the
  numbers and never claims a PDF is attached — he saves it from the print
  view and attaches it himself. Sending the bill from the server would need
  either a share link or a real PDF, and the latter is what the no-PDF-library
  rule rules out. See `src/lib/share.ts`.
- **`.rise` must never use `forwards` or `both` fill-mode.** It wraps every
  screen, and a *filled* animation stays applied after it ends — an applied
  opacity animation keeps a stacking context alive for good, which trapped
  the full-screen sheets and the running-total bar underneath the nav bar's
  `z-40` no matter what z-index they asked for. `backwards` gives the same
  smooth fade in and releases the context when the animation ends. The
  earlier form of this bug was the same wrapper animating `transform`, which
  additionally made it the containing block for every fixed descendant.
- **A customer copy never shows workflow status.** The printed bill prints
  PAID or PART PAID when money has arrived, and nothing otherwise — every
  bill he had sent read "Draft".
- **Sharing is what marks a bill sent.** Save as PDF, WhatsApp and Gmail all
  call `markSentIfDraft`; there is no chore to remember. Ten bills in, every
  one of them was still a draft.
- **A checklist and a template are the same table.** Before a job he writes
  the materials for a section and hands the list to a shop, who tick down it
  and give him an invoice. A section template is a `checklists` row with
  `is_template`, quantities blank; making a list copies its rows. Only the
  quantities change job to job, which is why the list screen is a quantity
  box per row and nothing else. `by_client` marks the lines the client buys
  himself — those print with a CLIENT badge and no tick box, so the shop
  knows not to supply them. Rows left at zero never reach the shop copy.
- **A bill can be split into named parts, and usually is not.** His big
  estimates are staged — Internal Wiring, Underground Cable, Meter Panal,
  BESCOM Charges — each with its own items, its own labour line and its own
  subtotal, and he used to write the four-line summary on a separate sheet.
  `line_items.section` holds the part; empty means a plain bill, which is
  what most of his cash bills are. The form's toggle is off unless the bill
  already has parts, so an ordinary bill looks exactly as it always did, and
  a new row inherits the part of the row above it so he types the name once.
  The printed sheet prints the summary block only when there are two or more.
- **The printed sheet is a GST tax invoice, modelled on his accountant's.**
  Letterhead with the mark and his contact block, a banner carrying the
  GSTIN and which copy it is, a Customer Detail panel, then a ruled grid
  that carries the tax *per line* — CGST and SGST each as a % and an
  Amount, IGST alone when interstate — and a foot of words, bank, terms,
  money ladder and signature. The whole thing is roughly 715px wide at
  print sizes against 718px of A4 at 10mm margins, so the grid headings
  must be allowed to wrap (`white-space: normal`): holding "Taxable
  Value" on one line is what pushes the Total column off the sheet.
- **A column that does not add up is the first thing an accountant sees.**
  Rounding each row and summing does not generally equal a total rounded
  once at the end, so `computeLineTaxes` in `src/lib/gst.ts` reconciles
  every column against `computeTotals` — the odd paisa goes onto the
  largest row. `computeTotals` stays the authority; the per-line function
  only ever redistributes its own rounding. Verified against his real
  17-Aug-2026 Nova Techset invoice, whose CGST column it reproduces
  exactly.
- **The printed sheet takes its figures from `totals`, not from the row.**
  `printedTotal` / `printedBalance` in the document page are recomputed,
  so the grid, the amount in words and the money ladder can never
  disagree with each other on the page. The app's own money screens
  (Home, balance due) keep reading the stored `total` and
  `amount_received` — those are about what he is owed, not about what the
  paper says.
- **Never name columns in the `clients` embed on the document page.**
  PostgREST rejects the entire query for one unknown column, `doc` comes
  back null and `notFound()` fires — so a migration that has not been run
  yet turns into a 404 on every single bill rather than a missing field.
  `clients(*)` degrades to a blank row instead.
- **The UPI QR writes its own width and height onto the `<svg>`** (132px),
  so the box around it must size the SVG (`.doc-qr > svg { width: 100% }`)
  rather than just clipping it — an undersized box printed "Scan to pay"
  across the code itself.
- **Spelling is proposed, never applied.** Two years of his bills carry
  the same slips — "colar", "modal", "Grue", "Labor", "Cealing" — and they
  print in the widest column of the customer's copy. `suggest` in
  `src/lib/spelling.ts` returns a tidier string or null; the bill form
  offers it under the description and Site/Job, and My Items & Rates
  offers it per row behind `?fix=1`. Nothing is ever rewritten without a
  tap, and `fixRateCardSpelling` recomputes the correction on the server
  so a stale tab cannot write something the dictionary would not propose.
- **His trade's words are not spelling mistakes.** Gatta, patti, potted,
  niles, checkey, swg, lisha and Roma are words on a Bangalore electrical
  bill. `TRADE_WORDS` in `src/lib/spelling.ts` holds them and every rule
  skips them — "correcting" one of those makes the bill worse than the
  typo did. Only add a word to the dictionary you are sure about; the
  stray "T" in "15 W L E D T Bulb" and the "Mass Pet" in "U P S Mass Pet
  Circuit Board" are left alone on purpose.
- **A run of single letters is not always an acronym.** "15 W L E D
  Bulb" joined blindly becomes "WLED" — the W is a unit. `SPACED_ACRONYMS`
  is therefore an explicit list, not a pattern.
- **`rate_card_items` is unique on (user_id, description), case
  sensitively.** So the spelling fix updates first and merges only when
  Postgres actually returns 23505 — a looser comparison of our own
  (`ilike`) would delete rows that were never going to clash.
- **Home has no "Needs your attention" list** — he asked for the stack of
  cards off, and was right. The duplicate-bill warning is the one thing
  that came back, as a single amber line above the clients that appears
  only when there is something to say. `findDuplicateBills` in
  `src/lib/summary.ts` is the rule and is tested; estimates are excluded
  because quoting the same job twice is an ordinary week, and bills with
  no customer are never matched against each other. Anything else that
  wants space on Home has to earn it the same way.
- **An empty drill-down is not an empty app.** `?show=` with nothing in it
  used to print "No bills yet — tap New Estimate", which reads as a fault
  when he has ten bills and simply no duplicates.
- **One estimate, one invoice.** `convertToInvoice` checks for an invoice
  already linked to the estimate and goes to it rather than minting a
  second. He had ₹38,062 of one apartment job on the books twice —
  INV-2026-013 and -014, same client, same job, same day — because
  tapping the button again is the obvious thing to do on a phone that has
  not visibly responded yet, and both bills then counted towards what he
  was owed.
- **The app must never claim a profit it cannot support.** It reported
  revenue minus labour and called it profit — ₹27,860 for 2026, against
  ₹0 of recorded materials on ₹85,615 invoiced, when roughly two thirds of
  what he bills is material he buys first. The figure was perhaps three
  times too flattering, on the screen he would use to decide his prices.
  `canShowMargin` in `src/lib/jobcost.ts` gates every margin on materials
  actually having been recorded; where they have not, both the Summary
  and the client page point him at `/day` instead of showing a number.
- **The shop list is a checklist, written before the shop run.** It was
  briefly given a price column per row so a priced list became the job's
  material cost. That is the wrong end of his day: he writes the list to
  know what to buy, and coming back afterwards to type what each line cost
  is precisely the data entry that never happens. Material cost is
  recorded on `/day` instead, where he is already sitting with the
  receipts, and the client picker on that form is what ties it to a job.
  Do not put prices back on the list.
- **The price book is a by-product of recording the day, never a chore.**
  It used to be a screen he fed by hand — add a shop, open it, type a
  price — and it held five prices across four shops in two years, which
  can answer nothing. Every price now comes from `/day`: he picks the
  shop, says how many, and the unit price is `amount / qty`. There is no
  hand entry left and there should not be. `/prices` only reads. Do not
  add a "record a price" form anywhere.
- **The chips on `/day` are what make the price book trustworthy.** He
  writes the same material three ways — his own list holds three spellings
  of 2.5 sqmm copper wire — and every variant that misses splits the price
  history, so the cheapest-shop answer gets worse the more he uses it.
  Tapping a name fixes the spelling at source. Ranked by what he has
  actually bought (counted on `item_key`, so the three spellings count
  once), topped up from the section templates by how many sections call
  for the thing — not by template order, which would just offer whatever
  sits at the top of the first list. Six, because eight was four rows.
- **A quantity is what turns a total into a price.** A day-book line with
  no quantity is still a perfectly good expense; it simply buys nothing
  for the price book and is skipped rather than guessed at.
- **`shops` is a list of names, not a feature.** He buys from five shops
  plus an "Other" for the small ones he will not name, and that list only
  exists to fill the shop box on `/day`. It lives in Settings, not the
  nav. `expenses.shop_id` is a real reference so a renamed shop stays
  joined up; `vendor` is kept alongside it as the name at the time.
- **Tagging a `/day` expense to a client is the only route material cost
  takes into the app.** Everything margin-related reads
  `expenses.client_id`, so an untagged shop bill is money that vanishes
  from job costing — worth protecting if that form ever changes.
- **Job margin costs labour at the work, not at the payment.**
  `worker_entries` of kind `work` tagged to the client, not the
  payments — a man paid late still worked, and a week's payment covers
  several jobs. The year's *cash* figure on the Summary is the opposite
  and reads payments. Two questions, both true, never mixed.
- **`daysToSettle` is null until a bill is fully covered**, which is
  correct, and twice made a part-payer read as someone who had paid
  nothing — Gopinath showed "no payments recorded yet" against ₹20,000
  received, on both the Summary and his own page. Anywhere that renders
  that null has to ask whether any payment exists before calling it none.
- **What he owes his men sits under the hero on Home.** Money out beside
  money in, on the screen he opens first — his week ends with paying
  Basava and Muttu on Saturday, and that used to be visible only if he
  tapped Labour. `labourDue` in `src/lib/summary.ts` is the figure and
  both screens read it: two places disagreeing about what he owes is
  worse than neither showing it. It sums the *positive* balances only —
  a man he has overpaid is not credit against a man he owes.
- **Home is the client list.** He opens the app to see who owes him what,
  not to read a stream of bills — every bill is already on its client, and
  the list said the same thing four times over. Each row carries the
  amount outstanding and one status word, where an unsent draft beats
  "unpaid" because money he has not billed for is not money he can chase.
  The bill list still exists, but only as a drill-down: `?show=unpaid`,
  which the figure in the hero links to, and `?q=` from search. Any other
  `?show=` value falls back to the client list rather than an empty page,
  so an old bookmark degrades quietly. **The Clients tab was removed**
  from the nav for the same reason — it was a second door to one room —
  and `/clients/[id]` therefore goes back to `/`, not to `/clients`.
- **`/day` is his evening.** He finishes on site, comes home and writes the
  day onto a spreadsheet. The page is one date with everything the app
  already knows filled in — labour paid, bills raised, money received —
  and one line for what it cannot know, which is the shop runs. Adding a
  line returns to the same day, so it is a list he works down rather than
  a form he reopens. Labour and payments are shown but not editable there:
  they belong to the labour book and the bill, and a second place to edit
  them is a second place for them to disagree.
- **A statement is derived, never stored.** `/labour/[id]/statement` and
  `/clients/[id]/statement` are built from `worker_entries`, `documents`
  and `payments` at read time, so they cannot drift from what the app
  shows. Both print through `.doc` and share the summary over WhatsApp.
  Estimates appear on a client statement but are never counted into the
  balance — a quote is not money owed.
- **`.doc-table` has no phone fallback on a statement**, unlike the bill,
  so it sits in `.doc-scroll`: scrolls inside its own box on a screen,
  `overflow: visible` in print. Without it the Paid column is cut off the
  right edge of the sheet on a phone and the page does not scroll.
- **Home answers one question: what am I owed, and what do I do now.**
  It carried a Received / Expenses / Profit strip, where Profit was
  received minus recorded spend — and he records no material expenses at
  all, so it was a confidently wrong number in the largest type on the
  screen. The year lives on `/summary`. Dropping it also took two
  round-trips to Singapore off the screen he opens most.
- **Do not put a figure on Home that the list below it already shows.**
  The "this month" card printed ₹1,16,287 two inches above a month
  heading reading SEP 2026 ₹1,16,287.
- **The bill renders twice.** `.doc-lines` (blocks) below 640px, and
  `.doc-table-wrap` (the ruled table) at 640px and up *and in print* — the
  table pushed the Amount column off a phone screen behind a scrollbar.
- **The printed bill is English only.** Its labels come from `docLabels` in
  `src/lib/i18n.ts`, never from `t` — the app toggles to Kannada for him, but
  the sheet goes to his client's accountant. Reaching for `t` inside the
  printable section is what produced a half-translated tax invoice once.
- **`business_profile.logo_url` is a path into `public/brand`**, chosen from
  `LOGO_OPTIONS`. A file whose name contains "lockup" already includes the
  business name, so the header suppresses the text name for those.
- **The middleware matcher must exclude static files.** Anything it matches
  gets an `auth.getUser()` round-trip to Singapore, and a redirect to /login
  when logged out — which once meant the login screen fetched its fonts and
  got HTML back, drawing the very tofu box `rupee-*.woff2` exists to prevent.
  Adding a new folder under `public/` means adding it to the matcher.
- **Never use `window.confirm` for a destructive action.** Once Chrome shows
  its "prevent this page from creating additional dialogs" checkbox and it is
  ticked, `confirm()` returns false instantly without drawing anything — so
  every delete in the app stops working silently, with nothing on screen to
  explain it. `ConfirmButton` arms in place instead: first tap arms, second
  submits, and it disarms itself after six seconds.
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
