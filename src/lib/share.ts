// Sharing a bill outside the app.
//
// `mailto:` cannot carry an attachment — that is a limitation of the
// scheme, not a choice — so the body has to stand on its own with the
// numbers in it. He saves the PDF from the print view and attaches it
// himself; if he forgets, the email is still a complete statement of
// what is owed. For that reason nothing here claims a file is attached.

export interface BillEmailInput {
  type: "estimate" | "invoice";
  serial: string;
  /** Already formatted dd-mmm-yyyy. */
  date: string;
  siteJob: string;
  /** Already formatted with the rupee sign. */
  total: string;
  received?: string;
  balance?: string;
  clientName: string;
  clientEmail: string;
  businessName: string;
  proprietorName: string;
  phone: string;
  upiId: string;
  terms: string;
}

export interface BillEmail {
  subject: string;
  body: string;
  href: string;
}

export function buildBillEmail(b: BillEmailInput): BillEmail {
  const isInvoice = b.type === "invoice";
  const noun = isInvoice ? "Invoice" : "Estimate";

  const subject = `${noun} ${b.serial} — ${b.businessName}`.trim();

  const lines: string[] = [];
  lines.push(`Dear ${b.clientName || "Sir/Madam"},`);
  lines.push("");
  lines.push(
    isInvoice
      ? `Please find our invoice for the work below.`
      : `Please find our estimate for the work below.`
  );
  lines.push("");
  if (b.siteJob) lines.push(`Work: ${b.siteJob}`);
  lines.push(`${noun} No: ${b.serial}`);
  lines.push(`Date: ${b.date}`);
  lines.push(`Amount: ${b.total}`);

  // Only worth saying when part of it is already settled.
  if (isInvoice && b.received && b.balance) {
    lines.push(`Received: ${b.received}`);
    lines.push(`Balance due: ${b.balance}`);
  }

  if (isInvoice && b.upiId) {
    lines.push("");
    lines.push(`Payment can be made by UPI to ${b.upiId}.`);
  }
  if (b.terms) {
    lines.push("");
    lines.push(b.terms);
  }

  lines.push("");
  lines.push("Regards,");
  if (b.proprietorName) lines.push(b.proprietorName);
  if (b.businessName) lines.push(b.businessName);
  if (b.phone) lines.push(b.phone);

  const body = lines.join("\r\n");

  const href =
    `mailto:${b.clientEmail}` +
    `?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return { subject, body, href };
}
