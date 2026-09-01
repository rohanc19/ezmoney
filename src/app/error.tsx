"use client";

// Friendly, plain-language error screen — never a stack trace.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <p className="mt-16 text-5xl">😕</p>
      <h1 className="mt-4 text-2xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-stone-600">
        Your data is safe. Please try again — if it keeps happening, close the app and open it
        again.
      </p>
      <button onClick={reset} className="btn-primary mt-6 w-full">
        Try again
      </button>
      <a href="/" className="btn-secondary mt-3 w-full">
        Go to Home
      </a>
    </main>
  );
}
