import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const GEMINI_MODEL = process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";
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

function geminiError(status: number, payload: any) {
  const message = payload?.error?.message;
  if (status === 401 || status === 403) return "Gemini rejected the API key. Check GEMINI_API_KEY in Vercel.";
  if (status === 429) return "Gemini image generation quota is exhausted. Check Google AI billing and rate limits.";
  return message || `Gemini image generation failed with HTTP ${status}.`;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const person = parseDataUrl(body.person);
    const tattoo = parseDataUrl(body.tattoo);
    const bodyPart = typeof body.bodyPart === "string" ? body.bodyPart.trim() : "";
    if (!bodyPart || bodyPart.length > 80) return NextResponse.json({ error: "Choose a valid body part." }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_KEY;
    if (!apiKey) return NextResponse.json({ error: "Gemini is not configured yet." }, { status: 503 });

    const prompt = `You are compositing a tattoo preview, not redesigning an image.\n\nIMAGE ROLES\n- Image 1 is the person base photo. Preserve it as the source of truth for identity, body, pose, framing, skin texture, lighting, clothing, background, and every existing tattoo.\n- Image 2 is the exact tattoo artwork to add. Treat it as a strict visual reference, not inspiration.\n\nPLACEMENT AND LEFT/RIGHT VIEWPOINT\nPlace only the new tattoo on the requested location: ${bodyPart}. Interpret every left/right instruction from the viewpoint of the photographer or viewer looking at Image 1, not from the model's own viewpoint. In other words, \"left side of the neck\" means the left side as it appears in the photo to the viewer, even if that corresponds to the model's anatomical right side. Use the visible left/right side in the image consistently for the entire composition. Never mirror or swap sides. Make the placement anatomically plausible and follow the body's perspective, curvature, lighting, and skin texture.\n\nNON-NEGOTIABLE PRESERVATION RULES\n- NEVER remove, erase, cover, replace, redraw, retouch, blur, fade, weaken, merge, or alter ANY existing tattoo from Image 1. Existing tattoos must remain visible and unchanged, even if they overlap, are near, or are behind the requested placement.\n- Do not clean up the skin or modify scars, marks, moles, hair, clothing, facial features, body shape, pose, background, or composition.\n- Do not move the new tattoo to a different body part or the opposite side. If the requested area is ambiguous, use the closest clearly visible surface on the viewer-facing side while keeping the existing tattoos intact.\n\nEXACT ARTWORK FIDELITY\n- Copy Image 2's design exactly: preserve its subject, linework, geometry, proportions, orientation, scale relationships, negative space, fine details, colors, shading, and edges.\n- Do not invent, omit, simplify, stylize, mirror, flip, stretch, distort, recolor, add text, or substitute any element of the provided design.\n- Do not add extra ornaments, background graphics, duplicate tattoos, or artistic interpretation.\n- Keep the tattoo artwork recognizable as the same supplied design at a glance.\n\nOUTPUT\nReturn one realistic edited image only. Add only the supplied tattoo, naturally integrated into the skin. No text, borders, logos, watermarks, labels, or other edits.`;
    const payload = {
      contents: [{
        parts: [
          { inlineData: { mimeType: person.mimeType, data: person.data.toString("base64") } },
          { inlineData: { mimeType: tattoo.mimeType, data: tattoo.data.toString("base64") } },
          { text: prompt },
        ],
      }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return NextResponse.json({ error: geminiError(response.status, result) }, { status: response.status >= 500 ? 502 : response.status });

    const parts = result?.candidates?.[0]?.content?.parts || [];
    const imagePart = parts.find((part: any) => part?.inlineData?.data);
    if (!imagePart) return NextResponse.json({ error: "Gemini returned no preview image." }, { status: 502 });
    const mimeType = imagePart.inlineData.mimeType || "image/png";
    return NextResponse.json({ image: `data:${mimeType};base64,${imagePart.inlineData.data}`, model: GEMINI_MODEL });
  } catch (error) {
    console.error("Tattoo visualization failed", error);
    const message = error instanceof Error ? error.message : "Could not create the preview.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
