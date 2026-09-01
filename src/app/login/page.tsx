import { login } from "@/lib/actions";
import { getDict } from "@/lib/i18n";

export default function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const t = getDict();
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <h1 className="text-center text-4xl font-extrabold text-accent">{t.appName}</h1>
      <p className="mt-2 text-center text-stone-500">Estimates · Invoices · Expenses</p>

      {searchParams.error && (
        <p className="mt-6 rounded-xl bg-red-50 p-4 text-center font-medium text-red-800">
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
    </main>
  );
}
