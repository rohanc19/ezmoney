"use client";

// Save as PDF, via the browser's own print dialog. Used where there is
// nothing to mark as sent — a shop list is not a bill.
export default function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-primary w-full text-xl" onClick={() => window.print()}>
      {label}
    </button>
  );
}
