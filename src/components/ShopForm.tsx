import { saveShop } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";
import type { Shop } from "@/lib/types";

// Server-rendered, no client JavaScript.
export default function ShopForm({ t, shop }: { t: Dict; shop?: Shop | null }) {
  return (
    <form action={saveShop} className="space-y-5 pb-4">
      {shop && <input type="hidden" name="id" value={shop.id} />}

      <div>
        <label className="label" htmlFor="name">
          {t.shopName}
        </label>
        <input id="name" name="name" required defaultValue={shop?.name ?? ""} className="field" />
      </div>

      {/* The area is what lets him weigh a cheaper price against a longer
          trip. No map, no distance — he knows the city. */}
      <div>
        <label className="label" htmlFor="area">
          {t.shopArea}
        </label>
        <input
          id="area"
          name="area"
          list="known-areas"
          defaultValue={shop?.area ?? ""}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="phone">
          {t.shopPhone}
        </label>
        <input
          id="phone"
          name="phone"
          inputMode="tel"
          defaultValue={shop?.phone ?? ""}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="address">
          {t.shopAddress}
        </label>
        <input id="address" name="address" defaultValue={shop?.address ?? ""} className="field" />
      </div>

      <div>
        <label className="label" htmlFor="notes">
          {t.notes}
        </label>
        <input id="notes" name="notes" defaultValue={shop?.notes ?? ""} className="field" />
      </div>

      <button type="submit" className="btn-primary w-full text-xl">
        {t.save}
      </button>
    </form>
  );
}
