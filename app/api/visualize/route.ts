import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
function parseDataUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid image input.");
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match || !allowed.has(match[1])) throw new Error("Please upload PNG, JPG, or WebP images.");
  if (Buffer.byteLength(match[2], "base64") > 8 * 1024 * 1024) throw new Error("Each image must be 8 MB or smaller.");
  return { mimeType: match[1], data: match[2] };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const person = parseDataUrl(body.person);
    const tattoo = parseDataUrl(body.tattoo);
    const bodyPart = typeof body.bodyPart === "string" ? body.bodyPart.trim() : "";
    if (!bodyPart || bodyPart.length > 80) return NextResponse.json({ error: "Choose a valid body part." }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "Gemini is not configured yet." }, { status: 503 });
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const model = process.env.GEMINI_IMAGE_MODEL || "gemini-3.1-flash-image-preview";
    const prompt = `Create a realistic tattoo placement preview. Use the first image as the exact base photograph of the person. Use the second image as the exact tattoo artwork reference. Place the tattoo on the person's ${bodyPart}. Preserve the tattoo design faithfully: do not redraw, beautify, simplify, mirror, crop, add, remove, or invent details. Scale and warp it naturally to the selected anatomy, following body perspective and curvature. Blend ink into the skin with realistic opacity, texture, lighting, and shadows while keeping the person's identity, pose, clothing, background, skin tone, and framing unchanged. Output only the edited photo, with no text, labels, borders, extra tattoos, logos, or watermarks.`;
    const response = await ai.models.generateContent({ model, contents: [{ role: "user", parts: [{ inlineData: person }, { inlineData: tattoo }, { text: prompt }] }], config: { responseModalities: ["IMAGE"] } });
    const parts = response.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((part) => part.inlineData?.data);
    if (!imagePart?.inlineData?.data) throw new Error("Gemini returned no preview image. Try clearer source photos.");
    return NextResponse.json({ image: `data:${imagePart.inlineData.mimeType || "image/png"};base64,${imagePart.inlineData.data}`, model });
  } catch (error) {
    console.error("Tattoo visualization failed", error);
    const message = error instanceof Error ? error.message : "Could not create the preview.";
    const lower = message.toLowerCase();
    if (lower.includes("quota") || lower.includes("resource_exhausted") || lower.includes("429")) {
      return NextResponse.json({ error: "Gemini image generation is temporarily unavailable because this API key has no image quota. Enable billing or image-generation quota in Google AI Studio, then try again." }, { status: 503 });
    }
    return NextResponse.json({ error: message.includes("API key") ? "Gemini authentication failed. Check the server configuration." : message }, { status: 500 });
  }
}
