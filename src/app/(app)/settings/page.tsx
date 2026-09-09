import Link from "next/link";
import { cookies } from "next/headers";
import { checkScanner, logout, saveProfile, setLanguage } from "@/lib/actions";
import { getDict, getLang } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";
import { LOGO_OPTIONS, STATES } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: { saved?: string; scan?: string };
}) {
  const t = getDict();
  const lang = getLang();
  const supabase = supabaseServer();
  const { data: p } = await supabase.from("business_profile").select("*").maybeSingle();

  // The result of the last "Check the scanner" tap, left in a short-lived
  // cookie by the action so this page stays a plain server render.
  let scanCheck: { ok: boolean; message: string } | null = null;
  if (searchParams.scan) {
    try {
      const raw = cookies().get("scan_check")?.value;
      if (raw) scanCheck = JSON.parse(raw);
    } catch {
      /* a failed check just shows nothing */
    }
  }

  return (
    <main>
      <h1 className="text-2xl font-extrabold">{t.settings}</h1>

      {searchParams.saved && (
        <p className="mt-4 rounded-2xl bg-green-100 p-3 text-center font-bold text-green-900">
          {t.saved}
        </p>
      )}

      {/* shortcuts */}
      <Link href="/rate-card" className="card mt-5 flex items-center justify-between p-4">
        <span>
          <span className="block font-extrabold">{t.rateCard}</span>
          <span className="text-sm text-stone-500">{t.rateCardHint}</span>
        </span>
        <span aria-hidden className="text-2xl text-stone-400">
          ›
        </span>
      </Link>

      <Link href="/summary" className="card mt-3 flex items-center justify-between gap-3 p-4">
        <span className="min-w-0">
          <span className="block font-extrabold">{t.summary}</span>
          <span className="block text-sm text-stone-500">{t.summaryHint}</span>
        </span>
        <span aria-hidden className="shrink-0 text-2xl text-stone-400">
          ›
        </span>
      </Link>

      <Link href="/shops" className="card mt-3 flex items-center justify-between gap-3 p-4">
        <span className="min-w-0">
          <span className="block font-extrabold">{t.priceBook}</span>
          <span className="block text-sm text-stone-500">{t.priceBookHint}</span>
        </span>
        <span aria-hidden className="shrink-0 text-2xl text-stone-400">
          ›
        </span>
      </Link>

      {/* language */}
      <section className="card mt-4 p-4">
        <h2 className="font-extrabold">{t.language}</h2>
        <form action={setLanguage} className="mt-3 flex gap-2">
          <button
            name="lang"
            value="en"
            className={`btn flex-1 ${
              lang === "en" ? "bg-accent text-white" : "border-2 border-line bg-white"
            }`}
          >
            English
          </button>
          <button
            name="lang"
            value="kn"
            className={`btn flex-1 ${
              lang === "kn" ? "bg-accent text-white" : "border-2 border-line bg-white"
            }`}
          >
            ಕನ್ನಡ
          </button>
        </form>
      </section>

      {/* business profile */}
      <form action={saveProfile} className="mt-4 space-y-4">
        <section className="card p-4">
          <h2 className="font-extrabold">{t.businessDetails}</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label" htmlFor="business_name">
                {t.businessName}
              </label>
              <input
                id="business_name"
                name="business_name"
                defaultValue={p?.business_name ?? ""}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="proprietor_name">
                {t.proprietorName}
              </label>
              <input
                id="proprietor_name"
                name="proprietor_name"
                defaultValue={p?.proprietor_name ?? ""}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="address">
                {t.address}
              </label>
              <input id="address" name="address" defaultValue={p?.address ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="city_pin">
                {t.cityPin}
              </label>
              <input
                id="city_pin"
                name="city_pin"
                defaultValue={p?.city_pin ?? ""}
                className="field"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label" htmlFor="phone">
                  {t.phone}
                </label>
                <input
                  id="phone"
                  name="phone"
                  inputMode="tel"
                  defaultValue={p?.phone ?? ""}
                  className="field"
                />
              </div>
              <div className="flex-1">
                <label className="label" htmlFor="email">
                  {t.email}
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={p?.email ?? ""}
                  className="field"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="state_code">
                {t.yourState}
              </label>
              <select
                id="state_code"
                name="state_code"
                defaultValue={p?.state_code ?? "29"}
                className="field"
              >
                {STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="font-extrabold">{t.gstSection}</h2>
          <div className="mt-3 space-y-4">
            <label className="flex min-h-[48px] items-center gap-3 font-semibold">
              <input
                type="checkbox"
                name="gst_enabled"
                defaultChecked={p?.gst_enabled ?? false}
                className="h-6 w-6 accent-teal-700"
              />
              {t.gstEnabled}
            </label>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label" htmlFor="gstin">
                  {t.gstin}
                </label>
                <input id="gstin" name="gstin" defaultValue={p?.gstin ?? ""} className="field" />
              </div>
              <div className="w-36">
                <label className="label" htmlFor="gst_rate">
                  {t.gstRate}
                </label>
                <input
                  id="gst_rate"
                  name="gst_rate"
                  inputMode="decimal"
                  defaultValue={String(p?.gst_rate ?? 0.18)}
                  className="field tnum"
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="default_hsn_sac">
                {t.defaultHsn}
              </label>
              <input
                id="default_hsn_sac"
                name="default_hsn_sac"
                inputMode="numeric"
                placeholder="995461"
                defaultValue={p?.default_hsn_sac ?? ""}
                className="field"
              />
            </div>
          </div>
        </section>

        {/* the mark at the top of every printed bill */}
        <section className="card p-4">
          <h2 className="font-extrabold">{t.logoSection}</h2>
          <p className="mt-1 text-sm text-stone-500">{t.logoHint}</p>
          <select
            name="logo_url"
            defaultValue={p?.logo_url ?? ""}
            className="field mt-3"
            aria-label={t.logoSection}
          >
            {LOGO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {p?.logo_url && (
            <div className="mt-3 rounded-xl border border-line bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.logo_url}
                alt={p.business_name || "Logo"}
                className="h-12 w-auto"
              />
            </div>
          )}
        </section>

        {/* what he charges for the job itself */}
        <section className="card p-4">
          <h2 className="font-extrabold">{t.serviceCharge}</h2>
          <p className="mt-1 text-sm text-stone-500">{t.serviceChargeHint}</p>
          <div className="mt-3 flex gap-3">
            <div className="w-32">
              <label className="label" htmlFor="default_service_charge_percent">
                {t.defaultServiceCharge}
              </label>
              <input
                id="default_service_charge_percent"
                name="default_service_charge_percent"
                inputMode="decimal"
                defaultValue={
                  Number(p?.default_service_charge_percent ?? 0) > 0
                    ? String(p?.default_service_charge_percent)
                    : ""
                }
                className="field tnum"
              />
            </div>
            <div className="flex-1">
              <label className="label" htmlFor="service_charge_label">
                {t.serviceChargeName}
              </label>
              <input
                id="service_charge_label"
                name="service_charge_label"
                placeholder="Service Charge"
                defaultValue={p?.service_charge_label ?? ""}
                className="field"
              />
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="font-extrabold">{t.bankSection}</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label" htmlFor="bank_name">
                {t.bankName}
              </label>
              <input
                id="bank_name"
                name="bank_name"
                defaultValue={p?.bank_name ?? ""}
                className="field"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label" htmlFor="account_no">
                  {t.accountNo}
                </label>
                <input
                  id="account_no"
                  name="account_no"
                  defaultValue={p?.account_no ?? ""}
                  className="field"
                />
              </div>
              <div className="w-40">
                <label className="label" htmlFor="ifsc">
                  {t.ifsc}
                </label>
                <input id="ifsc" name="ifsc" defaultValue={p?.ifsc ?? ""} className="field" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="upi_id">
                {t.upiId}
              </label>
              <input
                id="upi_id"
                name="upi_id"
                placeholder="name@oksbi"
                defaultValue={p?.upi_id ?? ""}
                className="field"
              />
              <p className="mt-1 text-sm text-stone-500">
                {t.scanToPay} — a QR code is printed on every invoice.
              </p>
            </div>
          </div>
        </section>

        <section className="card p-4">
          <h2 className="font-extrabold">{t.textsSection}</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label" htmlFor="payment_terms">
                {t.paymentTerms}
              </label>
              <textarea
                id="payment_terms"
                name="payment_terms"
                rows={2}
                defaultValue={p?.payment_terms ?? ""}
                className="field"
              />
            </div>
            <div>
              <label className="label" htmlFor="estimate_validity_note">
                {t.validityNote}
              </label>
              <textarea
                id="estimate_validity_note"
                name="estimate_validity_note"
                rows={2}
                defaultValue={p?.estimate_validity_note ?? ""}
                className="field"
              />
            </div>
          </div>
        </section>

        <button type="submit" className="btn-primary w-full text-xl">
          {t.save}
        </button>
      </form>

      {/* bill scanner — one live check that says exactly what is wrong */}
      <section id="scanner" className="card mt-4 p-4">
        <h2 className="font-extrabold">{t.scannerSection}</h2>
        <p className="mt-1 text-sm text-stone-500">{t.scanHint}</p>
        {scanCheck && (
          <p
            className={`mt-3 rounded-2xl p-3 text-sm font-semibold ${
              scanCheck.ok ? "bg-green-100 text-green-900" : "bg-amber-50 text-amber-900"
            }`}
          >
            {scanCheck.message}
          </p>
        )}
        <form action={checkScanner} className="mt-3">
          <button type="submit" className="btn-secondary w-full">
            {t.scannerCheck}
          </button>
        </form>
      </section>

      {/* backup */}
      <section className="card mt-4 p-4">
        <h2 className="font-extrabold">{t.exportSection}</h2>
        <p className="mt-1 text-sm text-stone-500">{t.exportEverythingHint}</p>
        <a href="/api/export?what=all" className="btn-primary mt-3 w-full" download>
          {t.exportEverything}
        </a>

        <p className="mt-5 text-sm text-stone-500">{t.exportHint}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a href="/api/export?what=documents" className="btn-secondary" download>
            {t.exportDocuments}
          </a>
          <a href="/api/export?what=line_items" className="btn-secondary" download>
            {t.exportItems}
          </a>
          <a href="/api/export?what=payments" className="btn-secondary" download>
            {t.exportPayments}
          </a>
          <a href="/api/export?what=expenses" className="btn-secondary" download>
            {t.exportExpenses}
          </a>
          <a href="/api/export?what=clients" className="btn-secondary" download>
            {t.exportClients}
          </a>
          <a href="/api/export?what=worker_entries" className="btn-secondary" download>
            {t.exportWorkers}
          </a>
          <a href="/api/export?what=item_prices" className="btn-secondary" download>
            {t.exportPrices}
          </a>
        </div>
      </section>

      <form action={logout} className="mt-8">
        <button type="submit" className="btn-danger w-full">
          {t.logout}
        </button>
      </form>
    </main>
  );
}
