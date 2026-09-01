# EzMoney

Estimates, invoices and expense tracking for a self-employed electrician.
Built to be simple for a non-technical user: big buttons, plain words,
three taps from "New" to a shareable PDF.

**Stack:** Next.js 14 (App Router, SSR — ~96 kB of client JS total) ·
Supabase (Postgres + Auth + RLS) · Tailwind CSS · browser-native
print-to-PDF. Deployed on Vercel; `git push` = update.

---

## 1. One-time setup (about 20 minutes)

You need free accounts on **supabase.com** and **vercel.com**, plus a
GitHub account. Do these in order.

### A. Create the Supabase project

1. supabase.com → **New project**. Name it `ezmoney`, pick the
   **Mumbai (ap-south-1)** region, set a strong database password
   (save it somewhere — you rarely need it again).
2. When the project finishes provisioning, open **SQL Editor** →
   **New query**, paste the whole of
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   and click **Run**. It should say "Success".
3. Create dad's login: **Authentication → Users → Add user →
   Create new user**. Use his email and a password you choose.
   Tick **Auto Confirm User**.
4. (Recommended) Load the demo data so you can test immediately:
   SQL Editor → new query → paste all of
   [`supabase/seed.sql`](supabase/seed.sql) → Run. This creates a
   sample business profile, one client, estimate `EST-2026-001`
   (2BHK rewiring), its converted invoice `INV-2026-001`, and two
   expenses — all attached to the user you just created.
5. Keep sessions long-lived (so dad stays logged in):
   **Authentication → Sessions** — leave "Time-box user sessions" and
   inactivity timeout **disabled** (the defaults). Nothing to change,
   just don't enable them.
6. Copy your keys: **Project Settings → API**. You need the
   **Project URL** and the **anon public** key.

### B. Run it locally

```bash
cp .env.example .env.local     # then edit .env.local with the URL + anon key
npm install
npm run dev                    # http://localhost:3000
```

Log in with the user you created in step A3. You should see the seeded
documents and the stat strip.

### C. Deploy to Vercel

1. Push this folder to a **private** GitHub repo:
   ```bash
   git init && git add -A && git commit -m "EzMoney v1"
   git branch -M main
   git remote add origin git@github.com:YOURNAME/ezmoney.git
   git push -u origin main
   ```
2. vercel.com → **Add New → Project** → import the `ezmoney` repo.
   Framework is auto-detected as Next.js. Before clicking Deploy, open
   **Environment Variables** and add both values from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy. You get a URL like `ezmoney-xxx.vercel.app`. Open it on
   dad's phone → log in → **Add to Home Screen** so it feels like an app.
   Do the same in the browser on the old PC (bookmark it).

**Updating the app later:** edit code → `git push` → Vercel redeploys
automatically in ~1 minute. That's the whole update mechanism.

---

## 2. Verify backups are on

Supabase dashboard → **Database → Backups**: the free tier takes
**daily automatic backups (7 days retention)** — confirm the list shows
dated entries after a day or two. For an extra manual copy, use
**Settings → Backup** in the app itself: it downloads bills, bill
items, expenses and clients as CSV files. Do that monthly and keep the
files in Google Drive.

---

## 3. How things work (for future-you)

- **Serial numbers** (`EST-2026-001` / `INV-2026-001`) come from the
  Postgres function `next_serial()` — an atomic counter per user, per
  type, per year. Two rapid creates can never collide. To switch to
  Indian financial-year numbering (Apr–Mar) later, set
  `business_profile.serial_year_basis = 'fiscal'` — no code change.
- **Totals**: line items are the source of truth
  (`amount = qty × rate`); subtotal/GST/total are recomputed
  server-side on every save and stored on the document row.
- **Estimate → invoice**: the "Make Final Invoice" button (shown on
  approved estimates) copies the client and all line items, takes a
  fresh INV serial, links back via `linked_estimate_id`, and opens the
  new invoice for editing.
- **PDF** is the browser's own print-to-PDF (`window.print()` + a print
  stylesheet). No PDF library; keeps working even if the server is down
  once the page is open.
- **GST**: single-rate line, toggled in Settings (default off). The
  schema notes (bottom of the migration) show exactly where HSN/SAC and
  CGST/SGST columns slot in later — all additive.
- **Language**: Settings has an English/ಕನ್ನಡ toggle (cookie-based,
  server-rendered). Printed documents stay in English.
- **RLS**: every table checks `auth.uid() = user_id`, so a second user
  later just works — no schema change.

## Repo map

```
supabase/migrations/0001_init.sql   schema + RLS + next_serial()
supabase/seed.sql                   demo data (run after creating the user)
src/middleware.ts                   session refresh + login redirect
src/lib/actions.ts                  all server actions (save/convert/delete/…)
src/lib/format.ts                   ₹ grouping, dd-mmm-yyyy, amount in words
src/lib/i18n.ts                     English + Kannada labels
src/app/(app)/page.tsx              Home: stat strip + searchable list
src/app/(app)/documents/…           create / edit / view-print screens
src/app/(app)/expenses/…            expenses list + form
src/app/(app)/settings/page.tsx     profile, GST, language, CSV backup
src/app/api/export/route.ts         CSV export
```

## Out of scope for v1 (on purpose)

Online payments, GST return filing, inventory, multi-user teams,
offline mode.
