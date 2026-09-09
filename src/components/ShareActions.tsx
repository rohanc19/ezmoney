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
  waHref,
  waLabel,
  mailHref,
  mailLabel,
}: {
  documentId: string;
  isDraft: boolean;
  pdfLabel: string;
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
