// Sharing a bill outside the app.
//
// `mailto:` cannot carry an attachment — that is a limitation of the
// scheme, not a choice — so the body has to stand on its own with the
// numbers in it. He saves the PDF from the print view and attaches it
// himself; if he forgets, the email is still a complete statement of
// what is owed. For that reason nothing here claims a file is attached.

/**
 * A WhatsApp link, with or without the customer's number.
 *
 * This used to be given up on when no number was saved, which hid the
 * button entirely — and only 3 of his 27 customers have one: 2 of the 10
 * who owe him money, 1 of those whose bill is still unsent. So on almost
 * every bill he most needed to send, the only thing on offer was a print
 * dialog, and 8 of his 10 unpaid customers are sitting on drafts.
 *
 * `wa.me` needs no number. Without one WhatsApp opens its own contact
 * picker and he chooses — which is the right way round anyway, since his
 * customers are in his phone rather than in this app, and making him type
 * a number into a form first is the chore that stopped it happening.
 *
 * Ten digits are assumed Indian and get a 91; anything longer is taken to
 * carry its own country code already.
 */
export function waLink(phone: string | null | undefined, text: string): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  const msg = encodeURIComponent(text);
  if (digits.length < 10) return `https://wa.me/?text=${msg}`;
  const full = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${full}?text=${msg}`;
}

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
  /** mailto: — needs a mail app registered with the browser. */
  href: string;
  /** Gmail's own compose window — needs only a browser. */
  gmailHref: string;
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

  // A mailto: link does nothing at all when the browser has no mail app
  // registered — silently, with no error — which is the normal state of a
  // desktop Chrome that has never had Mail set up. Gmail's compose URL
  // needs only a browser, and on his phone the Gmail app answers it.
  const gmailHref =
    `https://mail.google.com/mail/?view=cm&fs=1` +
    `&to=${encodeURIComponent(b.clientEmail)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return { subject, body, href, gmailHref };
}
