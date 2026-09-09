import { NextRequest, NextResponse } from "next/server";
import { ScanError, providerConfigured, scanImage } from "@/lib/scan/providers";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Reads a photographed bill and returns candidate line items.
// Nothing is saved here — he picks what to keep on the next screen.
export async function POST(request: NextRequest) {
  const supabase = supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not logged in" }, { status: 401 });

  if (!providerConfigured()) {
    return NextResponse.json(
      {
        error:
          "Photo reading isn't set up yet. Open Settings → Bill scanner and tap Check the scanner to see what is missing.",
      },
      { status: 503 }
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("image");
    if (value instanceof File) file = value;
  } catch {
    /* falls through to the friendly error below */
  }
  if (!file) {
    return NextResponse.json({ error: "No photo was received. Please try again." }, { status: 400 });
  }
  if (file.size > 6_000_000) {
    return NextResponse.json({ error: "That photo is too large. Try again." }, { status: 413 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const mediaType = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";

  try {
    const result = await scanImage(base64, mediaType);
    return NextResponse.json(result);
  } catch (err) {
    console.error("scan failed", err);
    // ScanError already carries a sentence that names the fix.
    const message =
      err instanceof ScanError
        ? err.friendly
        : "Could not read that photo. Try again in better light, or type the items in.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
