import QRCode from "qrcode";

// A UPI payment request encoded as a QR. The client scans it with any
// UPI app and the payee and exact amount are already filled in — he
// never reads out an account number again.
//
// Rendered to SVG on the server, so the page ships no extra JavaScript
// and the QR is part of the printed PDF.

export function buildUpiUri(opts: {
  upiId: string;
  payeeName: string;
  amount: number;
  note: string;
}): string | null {
  const pa = opts.upiId.trim();
  // A UPI ID always looks like name@bank.
  if (!pa || !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(pa)) return null;

  const params = new URLSearchParams({
    pa,
    pn: opts.payeeName.slice(0, 50) || "Payee",
    am: opts.amount.toFixed(2),
    cu: "INR",
    tn: opts.note.slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}

export async function upiQrSvg(uri: string, size = 132): Promise<string> {
  const svg = await QRCode.toString(uri, {
    type: "svg",
    margin: 0,
    errorCorrectionLevel: "M",
    color: { dark: "#1c1a17", light: "#ffffff" },
  });
  // Let CSS size it, and keep it crisp in print.
  return svg
    .replace(/<svg /, `<svg width="${size}" height="${size}" `)
    .replace(/shape-rendering="crispEdges"/, 'shape-rendering="crispEdges"');
}
