"use client";

import { useRouter } from "next/navigation";
import { markSentIfDraft } from "@/lib/actions";

// Sharing a bill IS sending it. He was never going to tap "Mark as Sent"
// as a separate chore — ten bills in and every one of them was still a
// draft — so the act of saving the PDF, or opening WhatsApp or Gmail,
// moves a draft to sent by itself.

export default function ShareActions({
  documentId,
  isDraft,
  pdfLabel,
  a5Label,
  waHref,
  waLabel,
  mailHref,
  mailLabel,
}: {
  documentId: string;
  isDraft: boolean;
  pdfLabel: string;
  a5Label: string;
  waHref: string | null;
  waLabel: string;
  mailHref: string | null;
  mailLabel: string;
}) {
  const router = useRouter();

  const markSent = () => {
    if (!isDraft) return;
    void markSentIfDraft(documentId).then(() => router.refresh());
  };

  return (
    <div className="mb-2">
      <button
        type="button"
        className="btn-primary w-full text-xl"
        onClick={() => {
          // print() blocks until he closes the dialog; only then is it
          // fair to call the bill sent.
          window.print();
          markSent();
        }}
      >
        {pdfLabel}
      </button>

      {/* A5 is the half sheet his bill books were. The sheet is laid out
          for A4, so rather than a second layout it is the same one,
          scaled: a page size for this print only, and a class the print
          CSS shrinks the bill by. Both come off again once the dialog
          closes, so the next ordinary print is A4 as before. */}
      <button
        type="button"
        className="mt-1 block min-h-[44px] w-full text-center text-sm font-bold text-accent"
        onClick={() => {
          const page = document.createElement("style");
          page.textContent = "@page { size: A5; margin: 6mm; }";
          document.head.appendChild(page);
          document.documentElement.classList.add("print-a5");
          window.print();
          document.documentElement.classList.remove("print-a5");
          page.remove();
          markSent();
        }}
      >
        {a5Label}
      </button>

      {(waHref || mailHref) && (
        <div className="mt-2 flex gap-2">
          {waHref && (
            <a
              href={waHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex-1 text-base"
              onClick={markSent}
            >
              {waLabel}
            </a>
          )}
          {mailHref && (
            <a
              href={mailHref}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary flex-1 text-base"
              onClick={markSent}
            >
              {mailLabel}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
