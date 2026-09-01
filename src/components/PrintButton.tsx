"use client";

// "Save as PDF" = the browser's own print-to-PDF. Works offline,
// works on the old PC, needs no library.
export default function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn-primary flex-1" onClick={() => window.print()}>
      {label}
    </button>
  );
}
