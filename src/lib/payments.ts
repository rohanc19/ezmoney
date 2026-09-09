// Part-payments. A bill is rarely settled in one go — an advance, some
// on progress, the rest on completion — so the payments table is the
// source of truth and the bill's status follows the money.
//
// Nothing here touches the database, so the rule that decides whether a
// bill reads Paid can be reasoned about and tested on its own.

/** Rupees are stored to the paisa; keep every sum on that grid. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function sumPayments(payments: { amount: number | string }[]): number {
  return round2(payments.reduce((sum, p) => sum + Number(p.amount), 0));
}

export interface PaymentState {
  received: number;
  balance: number;
  status: string;
}

/**
 * What a bill's status should be, given what has come in against it.
 *
 * `current` is the status it holds now, and is preserved for the states
 * that have nothing to do with money — a draft with no payments stays a
 * draft. Only the two money states are ever assigned here, and only these
 * two are ever taken away.
 */
export function derivePaymentState(
  total: number,
  received: number,
  current: string
): PaymentState {
  const balance = round2(total - received);

  // Half a paisa of slack: a bill must not sit one paisa short of settled
  // because a percentage landed on a third of a rupee.
  if (total > 0 && received >= total - 0.005) {
    return { received, balance, status: "paid" };
  }
  if (received > 0) {
    return { received, balance, status: "partly_paid" };
  }
  // The money is gone (a payment was deleted, or never existed). A bill
  // that had been settled falls back to sent, not to draft — it was still
  // issued to the client.
  if (current === "paid" || current === "partly_paid") {
    return { received, balance, status: "sent" };
  }
  return { received, balance, status: current };
}
