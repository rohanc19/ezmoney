import { saveClient } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";
import { STATES, type Client } from "@/lib/types";

// Server-rendered, no client JavaScript.
export default function ClientForm({
  t,
  client,
  gstEnabled,
  defaultStateCode,
}: {
  t: Dict;
  client?: Client | null;
  gstEnabled: boolean;
  defaultStateCode: string;
}) {
  return (
    <form action={saveClient} className="space-y-5 pb-4">
      {client && <input type="hidden" name="id" value={client.id} />}
      <div>
        <label className="label" htmlFor="name">
          {t.clientName}
        </label>
        <input id="name" name="name" required defaultValue={client?.name ?? ""} className="field" />
      </div>
      <div>
        <label className="label" htmlFor="phone">
          {t.clientPhone}
        </label>
        <input
          id="phone"
          name="phone"
          inputMode="tel"
          defaultValue={client?.phone ?? ""}
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="address">
          {t.clientAddress}
        </label>
        <input id="address" name="address" defaultValue={client?.address ?? ""} className="field" />
      </div>
      {gstEnabled && (
        <div className="card space-y-4 p-4">
          <div>
            <label className="label" htmlFor="state_code">
              {t.clientState}
            </label>
            <select
              id="state_code"
              name="state_code"
              defaultValue={client?.state_code || defaultStateCode}
              className="field"
            >
              {STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="gstin">
              {t.clientGstin}
            </label>
            <input id="gstin" name="gstin" defaultValue={client?.gstin ?? ""} className="field" />
          </div>
        </div>
      )}
      <div>
        <label className="label" htmlFor="notes">
          {t.notes}
        </label>
        <input id="notes" name="notes" defaultValue={client?.notes ?? ""} className="field" />
      </div>
      <button type="submit" className="btn-primary w-full text-xl">
        {t.save}
      </button>
    </form>
  );
}
