import { logout, saveProfile, setLanguage } from "@/lib/actions";
import { getDict, getLang } from "@/lib/i18n";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage({ searchParams }: { searchParams: { saved?: string } }) {
  const t = getDict();
  const lang = getLang();
  const supabase = supabaseServer();
  const { data: p } = await supabase.from("business_profile").select("*").maybeSingle();

  return (
    <main>
      <h1 className="text-2xl font-bold">{t.settings}</h1>

      {searchParams.saved && (
        <p className="mt-3 rounded-xl bg-green-100 p-3 text-center font-semibold text-green-900">
          {t.saved}
        </p>
      )}

      {/* language */}
      <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">{t.language}</h2>
        <form action={setLanguage} className="mt-3 flex gap-2">
          <button
            name="lang"
            value="en"
            className={`btn flex-1 ${lang === "en" ? "bg-accent text-white" : "border-2 border-stone-300 bg-white"}`}
          >
            English
          </button>
          <button
            name="lang"
            value="kn"
            className={`btn flex-1 ${lang === "kn" ? "bg-accent text-white" : "border-2 border-stone-300 bg-white"}`}
          >
            ಕನ್ನಡ
          </button>
        </form>
      </section>

      {/* business profile */}
      <form action={saveProfile} className="mt-5 space-y-5">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">{t.businessDetails}</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label" htmlFor="business_name">{t.businessName}</label>
              <input id="business_name" name="business_name" defaultValue={p?.business_name ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="proprietor_name">{t.proprietorName}</label>
              <input id="proprietor_name" name="proprietor_name" defaultValue={p?.proprietor_name ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="address">{t.address}</label>
              <input id="address" name="address" defaultValue={p?.address ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="city_pin">{t.cityPin}</label>
              <input id="city_pin" name="city_pin" defaultValue={p?.city_pin ?? ""} className="field" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label" htmlFor="phone">{t.phone}</label>
                <input id="phone" name="phone" inputMode="tel" defaultValue={p?.phone ?? ""} className="field" />
              </div>
              <div className="flex-1">
                <label className="label" htmlFor="email">{t.email}</label>
                <input id="email" name="email" type="email" defaultValue={p?.email ?? ""} className="field" />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">{t.gstSection}</h2>
          <div className="mt-3 space-y-4">
            <label className="flex min-h-[48px] items-center gap-3 font-medium">
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
                <label className="label" htmlFor="gstin">{t.gstin}</label>
                <input id="gstin" name="gstin" defaultValue={p?.gstin ?? ""} className="field" />
              </div>
              <div className="w-40">
                <label className="label" htmlFor="gst_rate">{t.gstRate}</label>
                <input id="gst_rate" name="gst_rate" inputMode="decimal" defaultValue={String(p?.gst_rate ?? 0.18)} className="field" />
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">{t.bankSection}</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label" htmlFor="bank_name">{t.bankName}</label>
              <input id="bank_name" name="bank_name" defaultValue={p?.bank_name ?? ""} className="field" />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="label" htmlFor="account_no">{t.accountNo}</label>
                <input id="account_no" name="account_no" defaultValue={p?.account_no ?? ""} className="field" />
              </div>
              <div className="w-40">
                <label className="label" htmlFor="ifsc">{t.ifsc}</label>
                <input id="ifsc" name="ifsc" defaultValue={p?.ifsc ?? ""} className="field" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="upi_id">{t.upiId}</label>
              <input id="upi_id" name="upi_id" defaultValue={p?.upi_id ?? ""} className="field" />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="font-bold">{t.textsSection}</h2>
          <div className="mt-3 space-y-4">
            <div>
              <label className="label" htmlFor="payment_terms">{t.paymentTerms}</label>
              <textarea id="payment_terms" name="payment_terms" rows={2} defaultValue={p?.payment_terms ?? ""} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="estimate_validity_note">{t.validityNote}</label>
              <textarea id="estimate_validity_note" name="estimate_validity_note" rows={2} defaultValue={p?.estimate_validity_note ?? ""} className="field" />
            </div>
          </div>
        </section>

        <button type="submit" className="btn-primary w-full text-xl">
          {t.save}
        </button>
      </form>

      {/* backup */}
      <section className="mt-5 rounded-2xl bg-white p-4 shadow-sm">
        <h2 className="font-bold">{t.exportSection}</h2>
        <p className="mt-1 text-sm text-stone-500">{t.exportHint}</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a href="/api/export?what=documents" className="btn-secondary" download>
            {t.exportDocuments}
          </a>
          <a href="/api/export?what=line_items" className="btn-secondary" download>
            {t.exportItems}
          </a>
          <a href="/api/export?what=expenses" className="btn-secondary" download>
            {t.exportExpenses}
          </a>
          <a href="/api/export?what=clients" className="btn-secondary" download>
            {t.exportClients}
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
