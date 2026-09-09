# Handoff — where EzMoney stands

Written 8 Sep 2026, at the end of the session that built v1 and v2. `CLAUDE.md`
holds the durable project rules; this file holds the *state* — what is done, what
is half-done, and what was decided and why.

---

## Done and live

**v1** — login, home with the year's money, create/edit bills, A4 print view with
Save-as-PDF, one-tap estimate → final invoice, expenses, settings, CSV export,
English/Kannada toggle. Deployed on Vercel, running against Supabase, installed on
his phone (Add to Home Screen) and as a Chrome app window on the old PC.

**v2** — shipped in commit `729e1ba`:

| Feature | Notes |
|---|---|
| Full GST tax invoice | Per-line HSN/SAC, CGST/SGST vs IGST chosen from state codes, place of supply, tax summary by slab |
| UPI QR on invoices | Server-rendered SVG, zero client JS, prints on the PDF |
| Rate card | Saved items with usual rates; bills you save teach it automatically |
| Client ledger | Clients tab, sorted by who owes money; per-client bills, payments, expenses |
| Receipt photos | Camera → downscaled on device → private Supabase Storage bucket |
| Bill scanner | Photograph a supplier bill → tickable line items; also fills the expense form |
| Visual pass | Self-hosted Manrope, warmer palette, dark hero on Home, active nav state, CSS-only motion |

Also fixed along the way: the ₹ glyph was rendering as a tofu box on his PC, so the
app now ships two ~700-byte fonts containing only that character.

**v3 + v4** — built after the first two weeks of use, from what he asked for:

| Feature | Notes |
|---|---|
| Labour book | A tab of the people he hires. Per person: work days (days × wage, or a lump sum) and money paid (payment or advance). Earned − Paid = to pay. Payments count in the year's expenses on Home |
| Service charge | Per-bill, percent of items or a flat figure, GST-taxable, with a usual-% default in Settings |
| Redesigned bill | Rebuilt as one ruled A4 sheet — titled band, bordered head panels, fully gridded items table, amount-in-words beside the money stack, bank/UPI/QR against the signature block. Header rows keep their tint in print |
| Shop price book | Shops (with an *area*), and dated prices per item. Filled in one tap from a photographed supplier bill; read back by item search, per shop, and as a hint under the bill form while he types a material |
| Scanner diagnostics | Every Google Vision failure now names its own fix; Settings → Bill scanner runs a live check. Falls back to Claude when Google reads nothing |

Nav went to six tabs with inline-SVG icons (the emoji were a tofu risk on his PC). The price book hangs off Expenses and Settings rather than taking a seventh tab.

## Open threads

1. **Logo not finalised.** He chose the "Bolt Cut" CE mark and it is built —
   `public/brand/` has SVG, PNG sizes, both lockups, one-colour stamp version and
   icon sizes, plus a `README.txt` with usage rules. Then he asked for variations:
   crossed-bolt, RYB phase wires, and bulb-enclosing families, and finally for the
   bolt-filament bulb to be refined (four versions produced: clipped filament, hung
   filament, stacked, filled glass). **He has not picked between Bolt Cut and the
   refined bulb.** Until he does, nothing is wired into the app.
2. **Logo is not on the bills yet.** `business_profile.logo_url` exists and is
   unused. The plan when he picks: horizontal lockup top-left of the printed
   estimate/invoice replacing the plain-text business name, and the CE tile as the
   app icon in place of the current ⚡₹ mark.
3. **`GOOGLE_VISION_API_KEY` is still not set in Vercel.** This is the one thing
   blocking the scanner, and the scanner is now what fills the price book. Google
   Cloud requires a billing account even for the free 1,000 OCR calls/month. Once
   the key is in, **Settings → Bill scanner → Check the scanner** will say either
   that it works or exactly which of billing / API-enabled / key-restriction is
   wrong — no guessing from a 403.
4. **Scanner accuracy is untested on his real suppliers' bills.** The parser was
   validated against printed and scrappy sample bills (it correctly ignores shop
   addresses and phone numbers), but it will need tuning against actual photos.
   `src/lib/scan/parse.ts` is where that tuning goes; switching to Claude vision is
   an env-var change if handwriting turns out to matter.
5. **The price book starts empty**, and it is only worth reading once it has a
   few shops in it. The intended way in is the scanner, not typing — so this
   thread is really thread 3 again.
6. **Existing clients need their state set** (client edit page), or GST is computed
   as intrastate for them.
7. **Demo data may still be in the database.** To clear before real use:
   `delete from public.line_items; delete from public.documents; delete from
   public.expenses; delete from public.clients; delete from public.doc_counters;`
   — leaves his login and business profile intact and resets serials to 001.
8. **Leftover files in `~/Projects`**: `_to_delete_ezmoney_zip`,
   `_to_delete_ezmoney_v2_zip`, `ezmoney-v2.zip`, `chandra-electricals-logo.zip`.
   Safe to bin.

## Decisions worth not relitigating

- **Hosted web app, not desktop.** So Rohan can push updates centrally and his dad
  installs nothing.
- **Browser print-to-PDF, not a PDF library.** Keeps the bundle small and keeps
  working if the server is momentarily down once a page is open.
- **Supabase in Singapore, Vercel functions in Singapore.** Region matching matters
  more than proximity to Bangalore, because a page load makes several database
  round-trips but only one trip to his phone.
- **Same layout on phone and desktop** — one centred column, ~770px. He learns one
  interface. A wide-screen table view was considered and deliberately deferred until
  real use shows it is needed.
- **The competition is real** (Vyapar, myBillBook, Zoho Invoice). The reasons to
  keep building: his exact estimate → approve → invoice flow as the core, the old PC
  as a first-class device, no upsell, and full data ownership.
- **Two weeks of real use before more features.** The next feature list should come
  from watching him make ten real bills, not from the backlog below.

## Backlog, roughly ranked

Part-payments and balance due · unpaid-bill reminders with one-tap WhatsApp nudge ·
duplicate a past bill · monthly/yearly summary for the accountant · Kannada on the
printed bill · offline mode · real distances in the price book (deliberately not
built — the shop's *area* plus his own knowledge of Bangalore does the job without
a maps API, a billing account, or client-side JavaScript).
