import { parseBillText } from "@/lib/scan/parse";
import type { ScanResult } from "@/lib/types";

// Reading a photographed bill happens in two steps: get the text off the
// image (the provider), then turn that text into items (the parser).
// Swapping provider is an environment-variable change — nothing else in
// the app knows which one is in use.
//
//   SCAN_PROVIDER=google  + GOOGLE_VISION_API_KEY=...     (default)
//   SCAN_PROVIDER=claude  + ANTHROPIC_API_KEY=...         (better on
//                            handwriting; returns items directly)

export type Provider = "google" | "claude";

export function activeProvider(): Provider {
  const p = (process.env.SCAN_PROVIDER ?? "google").toLowerCase();
  return p === "claude" ? "claude" : "google";
}

export function providerConfigured(): boolean {
  return activeProvider() === "claude"
    ? !!process.env.ANTHROPIC_API_KEY
    : !!process.env.GOOGLE_VISION_API_KEY;
}

async function googleScan(base64: string): Promise<ScanResult> {
  const key = process.env.GOOGLE_VISION_API_KEY!;
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [
        {
          image: { content: base64 },
          features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
          imageContext: { languageHints: ["en", "kn"] },
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`vision ${res.status}`);
  }
  const json = (await res.json()) as {
    responses?: { fullTextAnnotation?: { text?: string }; error?: { message: string } }[];
  };
  const first = json.responses?.[0];
  if (first?.error) throw new Error(first.error.message);
  const text = first?.fullTextAnnotation?.text ?? "";
  return parseBillText(text);
}

async function claudeScan(base64: string, mediaType: string): Promise<ScanResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.SCAN_MODEL ?? "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            {
              type: "text",
              text:
                "This is a photo of a shop bill from an electrical goods supplier in India. " +
                "Return ONLY a JSON object, no prose, shaped: " +
                '{"vendor":string,"date":"YYYY-MM-DD"|null,"grandTotal":number|null,' +
                '"items":[{"description":string,"qty":number,"unit":string,"rate":number,"amount":number}]}. ' +
                "Units must be one of Nos, Mtr, Ft, Hrs, Day, Job, Set, Point, Lump. " +
                "Include only real purchased line items — never totals, tax lines or headers. " +
                "If a value is unreadable, make your best estimate from the arithmetic.",
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) throw new Error(`claude ${res.status}`);
  const json = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = json.content?.find((c) => c.type === "text")?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("no json");
  const parsed = JSON.parse(match[0]) as Partial<ScanResult>;
  return {
    items: (parsed.items ?? []).map((i) => ({
      description: String(i.description ?? "").slice(0, 90),
      qty: Number(i.qty) || 1,
      unit: String(i.unit ?? "Nos"),
      rate: Number(i.rate) || 0,
      amount: Number(i.amount) || 0,
    })),
    vendor: String(parsed.vendor ?? ""),
    date: parsed.date ?? null,
    grandTotal: parsed.grandTotal ?? null,
    rawLines: 0,
  };
}

export async function scanImage(base64: string, mediaType: string): Promise<ScanResult> {
  return activeProvider() === "claude"
    ? claudeScan(base64, mediaType)
    : googleScan(base64);
}
