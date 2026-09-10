import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const NARA_EDIT_URL = "https://api-images.bynara.id/v1/images/edits";
const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);

type ImageInput = { mimeType: string; data: Buffer };

function parseDataUrl(value: unknown): ImageInput {
  if (typeof value !== "string") throw new Error("Invalid image input.");
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !allowed.has(match[1])) throw new Error("Please upload PNG, JPG, or WebP images.");
  const data = Buffer.from(match[2], "base64");
  if (data.byteLength > 8 * 1024 * 1024) throw new Error("Each image must be 8 MB or smaller.");
  return { mimeType: match[1], data };
}

function extension(mimeType: string) {
  return mimeType === "image/jpeg" ? "jpg" : mimeType.split("/")[1];
}

function providerError(status: number, payload: unknown) {
  const message = typeof payload === "object" && payload !== null && "error" in payload
    ? (payload as { error?: { message?: string } | string }).error
    : undefined;
  const detail = typeof message === "string" ? message : message?.message;
  if (status === 401 || status === 403) return "Nara rejected the image API key. Check the NARA_API_KEY value in Vercel.";
  if (status === 429) return "Nara image generation is rate limited. Please wait a moment and try again.";
  return detail || `Nara image generation failed with HTTP ${status}.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const person = parseDataUrl(body.person);
    const tattoo = parseDataUrl(body.tattoo);
    const bodyPart = typeof body.bodyPart === "string" ? body.bodyPart.trim() : "";
    if (!bodyPart || bodyPart.length > 80) return NextResponse.json({ error: "Choose a valid body part." }, { status: 400 });
    if (!process.env.NARA_API_KEY) return NextResponse.json({ error: "Nara is not configured yet." }, { status: 503 });

    const form = new FormData();
    form.append("image", new Blob([new Uint8Array(person.data)], { type: person.mimeType }), `person.${extension(person.mimeType)}`);
    form.append("image2", new Blob([new Uint8Array(tattoo.data)], { type: tattoo.mimeType }), `tattoo.${extension(tattoo.mimeType)}`);
    form.append("model", process.env.NARA_IMAGE_MODEL || "grok-imagine");
    form.append("prompt", `Create a realistic tattoo placement preview. The first reference image is the exact base photograph of the person. The second reference image is the exact tattoo artwork. Place the tattoo on the person's ${bodyPart}. Preserve the tattoo design faithfully: do not redraw, beautify, simplify, mirror, crop, add, remove, or invent details. Scale and warp it naturally to the selected anatomy, following body perspective and curvature. Blend ink into the skin with realistic opacity, texture, lighting, and shadows while keeping the person's identity, pose, clothing, background, skin tone, and framing unchanged. Output only the edited photo, with no text, labels, borders, extra tattoos, logos, or watermarks.`);
    form.append("size", "1024x1536");
    form.append("prompt_extend", "true");
    form.append("watermark", "false");

    const response = await fetch(NARA_EDIT_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.NARA_API_KEY}` },
      body: form,
    });
    const raw = await response.text();
    let payload: any = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { payload = {}; }
    if (!response.ok) return NextResponse.json({ error: providerError(response.status, payload) }, { status: response.status >= 500 ? 502 : response.status });

    const encoded = payload?.data?.[0]?.b64_json || payload?.data?.[0]?.b64 || payload?.images?.[0]?.b64_json;
    const imageUrl = payload?.data?.[0]?.url || payload?.images?.[0]?.url;
    if (!encoded && !imageUrl) return NextResponse.json({ error: "Nara returned no preview image." }, { status: 502 });
    const resolvedUrl = typeof imageUrl === "string" && imageUrl.startsWith("/") ? `https://api-images.bynara.id${imageUrl}` : imageUrl;
    return NextResponse.json({ image: encoded ? `data:image/png;base64,${encoded}` : resolvedUrl, model: process.env.NARA_IMAGE_MODEL || "grok-imagine" });
  } catch (error) {
    console.error("Tattoo visualization failed", error);
    const message = error instanceof Error ? error.message : "Could not create the preview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
