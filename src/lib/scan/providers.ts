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
//
// If Google is the provider and an Anthropic key also happens to be set,
// a photo Google could read no items from is quietly retried on Claude.
// Printed bills stay on the cheap path; only the hard ones cost more.

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

function claudeConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Google's failures are all HTTP 403 with different prose inside. Left
 * as-is he would see "vision 403" and have no idea what to do, so each
 * one is turned into the sentence that names the actual fix.
 */
export function explainGoogleError(status: number, message: string): string {
  const m = message.toLowerCase();
  if (m.includes("api key not valid") || m.includes("api_key_invalid") || status === 400) {
    return "The scanner key is wrong. Check GOOGLE_VISION_API_KEY in Vercel — copy it again from Google Cloud → APIs & Services → Credentials.";
  }
  if (m.includes("billing")) {
    return "Google needs a billing account on the project before it will read photos, even for the free 1,000 a month. Turn billing on in Google Cloud → Billing, then try again.";
  }
  if (m.includes("has not been used") || m.includes("is disabled") || m.includes("not enabled")) {
    return "The Cloud Vision API is not switched on for this Google project. Open Google Cloud → APIs & Services → Enable APIs, turn on Cloud Vision API, wait a minute, then try again.";
  }
  if (m.includes("referer") || m.includes("restriction") || m.includes("blocked")) {
    return "The scanner key is restricted and will not accept calls from the server. In Google Cloud → Credentials, set Application restrictions to None and restrict it to the Cloud Vision API instead.";
  }
  if (status === 429 || m.includes("quota") || m.includes("rate limit")) {
    return "Google's free scanning limit for this month is used up. It resets next month.";
  }
  if (status === 401 || status === 403) {
    return `Google refused the scanner key (${status}). Check the key and that Cloud Vision API is enabled and billing is on.`;
  }
  return `Google could not read the photo (${status}). Try again in better light, or type the items in.`;
}

export function explainClaudeError(status: number, message: string): string {
  if (status === 401) {
    return "The Anthropic key is wrong or expired. Check ANTHROPIC_API_KEY in Vercel.";
  }
  if (status === 429) {
    return "Too many photos at once. Wait a minute and try again.";
  }
  if (status === 400 && message) {
    return `Anthropic rejected the request: ${message.slice(0, 160)}`;
  }
  return `Anthropic could not read the photo (${status}). Try again, or type the items in.`;
}

/** An error that already carries a sentence he can act on. */
export class ScanError extends Error {
  readonly friendly: string;
  constructor(friendly: string, detail: string) {
    super(detail);
    this.friendly = friendly;
    this.name = "ScanError";
  }
}

async function googleScan(base64: string): Promise<ScanResult> {
  const key = process.env.GOOGLE_VISION_API_KEY!;
  let res: Response;
  try {
    res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${key}`, {
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
  } catch (err) {
    throw new ScanError(
      "Could not reach Google to read the photo. Check the internet and try again.",
      String(err)
    );
  }

  // Both the HTTP status and the per-image slot can carry the failure.
  if (!res.ok) {
    const body = await res.text();
    throw new ScanError(explainGoogleError(res.status, body), `vision ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    responses?: { fullTextAnnotation?: { text?: string }; error?: { message: string; code?: number } }[];
  };
  const first = json.responses?.[0];
  if (first?.error) {
    throw new ScanError(
      explainGoogleError(first.error.code ?? 400, first.error.message),
      `vision: ${first.error.message}`
    );
  }

  const text = first?.fullTextAnnotation?.text ?? "";
  return parseBillText(text);
}

async function claudeScan(base64: string, mediaType: string): Promise<ScanResult> {
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.SCAN_MODEL ?? "claude-opus-5",
        max_tokens: 8000,
        // Reading a bill is not a hard reasoning problem — low effort keeps
        // it quick and cheap while leaving thinking on.
        output_config: { effort: "low" },
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
  } catch (err) {
    throw new ScanError(
      "Could not reach the reading service. Check the internet and try again.",
      String(err)
    );
  }

  if (!res.ok) {
    const body = await res.text();
    throw new ScanError(
      explainClaudeError(res.status, body),
      `claude ${res.status}: ${body.slice(0, 300)}`
    );
  }
  const json = (await res.json()) as {
    stop_reason?: string;
    content?: { type: string; text?: string }[];
  };
  if (json.stop_reason === "refusal") {
    throw new ScanError(
      "The reading service would not process that photo. Type the items in instead.",
      "claude refusal"
    );
  }
  // Thinking blocks may sit ahead of the answer — take the text ones.
  const text = (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("\n");
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new ScanError(
      "Nothing could be read off that photo. Try again in better light, or type the items in.",
      "no json in response"
    );
  }
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
  if (activeProvider() === "claude") return claudeScan(base64, mediaType);

  const result = await googleScan(base64);
  // Google read the page but the parser found nothing usable — usually a
  // handwritten or badly lit bill. If Claude is available, try once more.
  if (result.items.length === 0 && claudeConfigured()) {
    try {
      return await claudeScan(base64, mediaType);
    } catch {
      return result;
    }
  }
  return result;
}

export interface ProviderStatus {
  provider: Provider;
  keySet: boolean;
  ok: boolean;
  message: string;
}

/**
 * A live check he can run from Settings. It costs one tiny request and
 * answers the only question that matters: does the scanner work, and if
 * not, what exactly should be fixed.
 */
export async function probeProvider(): Promise<ProviderStatus> {
  const provider = activeProvider();

  if (!providerConfigured()) {
    return {
      provider,
      keySet: false,
      ok: false,
      message:
        provider === "claude"
          ? "ANTHROPIC_API_KEY is not set in Vercel. Add it under Project → Settings → Environment Variables, then redeploy."
          : "GOOGLE_VISION_API_KEY is not set in Vercel. Add it under Project → Settings → Environment Variables, then redeploy.",
    };
  }

  try {
    if (provider === "claude") {
      // Listing models validates the key without paying for inference.
      const res = await fetch("https://api.anthropic.com/v1/models?limit=1", {
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
      });
      if (!res.ok) {
        return {
          provider,
          keySet: true,
          ok: false,
          message: explainClaudeError(res.status, await res.text()),
        };
      }
      return { provider, keySet: true, ok: true, message: "The bill scanner is working." };
    }

    // A 1x1 white PNG: enough for Google to check the key, the API and
    // billing, and small enough to be free.
    const pixel =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{ image: { content: pixel }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }],
        }),
      }
    );
    if (!res.ok) {
      return {
        provider,
        keySet: true,
        ok: false,
        message: explainGoogleError(res.status, await res.text()),
      };
    }
    const json = (await res.json()) as {
      responses?: { error?: { message: string; code?: number } }[];
    };
    const err = json.responses?.[0]?.error;
    if (err) {
      return {
        provider,
        keySet: true,
        ok: false,
        message: explainGoogleError(err.code ?? 400, err.message),
      };
    }
    return {
      provider,
      keySet: true,
      ok: true,
      message: claudeConfigured()
        ? "The bill scanner is working. Hard-to-read bills will also be retried on Claude."
        : "The bill scanner is working.",
    };
  } catch (err) {
    return {
      provider,
      keySet: true,
      ok: false,
      message: `Could not reach the scanner service. Check the internet and try again. (${String(err).slice(0, 120)})`,
    };
  }
}
