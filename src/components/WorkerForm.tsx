import { saveWorker } from "@/lib/actions";
import type { Dict } from "@/lib/i18n";
import { WORKER_SKILLS, type Worker } from "@/lib/types";

// Server-rendered, no client JavaScript. Same shape as the client form
// so there is only one kind of "add a person" screen to learn.
export default function WorkerForm({ t, worker }: { t: Dict; worker?: Worker | null }) {
  return (
    <form action={saveWorker} className="space-y-5 pb-4">
      {worker && <input type="hidden" name="id" value={worker.id} />}

      <div>
        <label className="label" htmlFor="name">
          {t.workerName}
        </label>
        <input id="name" name="name" required defaultValue={worker?.name ?? ""} className="field" />
      </div>

      <div>
        <label className="label" htmlFor="phone">
          {t.workerPhone}
        </label>
        <input
          id="phone"
          name="phone"
          inputMode="tel"
          defaultValue={worker?.phone ?? ""}
          className="field"
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label className="label" htmlFor="skill">
            {t.workerSkill}
          </label>
          <select
            id="skill"
            name="skill"
            defaultValue={worker?.skill ?? "Helper"}
            className="field"
          >
            {WORKER_SKILLS.map((sk) => (
              <option key={sk}>{sk}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="daily_rate">
            {t.workerDailyRate}
          </label>
          <input
            id="daily_rate"
            name="daily_rate"
            inputMode="decimal"
            defaultValue={worker ? String(worker.daily_rate) : ""}
            className="field tnum"
          />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="address">
          {t.workerAddress}
        </label>
        <input
          id="address"
          name="address"
          defaultValue={worker?.address ?? ""}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="notes">
          {t.notes}
        </label>
        <input id="notes" name="notes" defaultValue={worker?.notes ?? ""} className="field" />
      </div>

      {worker && (
        <label className="card flex min-h-[48px] items-center gap-3 p-4">
          <input
            type="checkbox"
            name="active"
            defaultChecked={worker.active}
            className="h-6 w-6 accent-teal-700"
          />
          <span className="font-semibold">{t.workerActive}</span>
        </label>
      )}

      <button type="submit" className="btn-primary w-full text-xl">
        {t.save}
      </button>
    </form>
  );
}
