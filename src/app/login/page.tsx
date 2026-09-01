import { login } from "@/lib/actions";
import { getDict } from "@/lib/i18n";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const t = getDict();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="rise">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-accent text-3xl font-extrabold text-white shadow-lift">
          ₹
        </div>
        <h1 className="mt-4 text-center text-4xl font-extrabold text-accent-dark">{t.appName}</h1>
        <p className="mt-1 text-center text-stone-500">Estimates · Invoices · Expenses</p>

        {searchParams.error && (
          <p className="mt-6 rounded-2xl bg-red-50 p-4 text-center font-semibold text-red-800">
            {t.loginError}
          </p>
        )}

        <form action={login} className="mt-8 space-y-5">
          <div>
            <label htmlFor="email" className="label">
              {t.email}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="field"
            />
          </div>
          <div>
            <label htmlFor="password" className="label">
              {t.password}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="field"
            />
          </div>
          <button type="submit" className="btn-primary w-full text-xl">
            {t.login}
          </button>
        </form>
      </div>
    </main>
  );
}
