import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { createHash, randomBytes, randomUUID } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIME_EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

function decodeImage(value: unknown) {
  if (typeof value !== "string") throw new Error("An image is missing.");
  const match = value.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) throw new Error("Images must be PNG, JPG, or WebP.");
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error("Each shared image must be 5 MB or smaller.");
  return { bytes, mimeType: match[1], ext: MIME_EXT[match[1]] };
}

export async function POST(request: Request) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Public sharing is not configured yet. Add a Vercel Blob store to enable it." }, { status: 503 });
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 4 * 1024 * 1024) return NextResponse.json({ error: "The combined upload is too large. Try smaller images." }, { status: 413 });
    const body = await request.json();
    const bodyPart = typeof body.bodyPart === "string" ? body.bodyPart.trim() : "";
    const requestText = typeof body.requestText === "string" ? body.requestText.trim() : "";
    if (!bodyPart || bodyPart.length > 80 || requestText.length > 600) return NextResponse.json({ error: "The placement or request is invalid." }, { status: 400 });
    const images = [decodeImage(body.person), decodeImage(body.tattoo), decodeImage(body.result)];
    const id = randomUUID();
    const deleteToken = randomBytes(32).toString("hex");
    const deleteTokenHash = createHash("sha256").update(deleteToken).digest("hex");
    const names = ["person", "tattoo", "result"];
    const stored = await Promise.all(images.map((image, index) => put(`tattoo-shares/${id}/${names[index]}.${image.ext}`, image.bytes, {
      access: "public", addRandomSuffix: false, contentType: image.mimeType,
    })));
    const record = {
      id, createdAt: new Date().toISOString(), bodyPart, requestText, deleteTokenHash,
      person: stored[0].url, tattoo: stored[1].url, result: stored[2].url,
    };
    await put(`tattoo-shares/${id}/share.json`, JSON.stringify(record), {
      access: "public", addRandomSuffix: false, contentType: "application/json; charset=utf-8",
    });
    return NextResponse.json({ id, deleteToken });
  } catch (error) {
    console.error("Creating public tattoo share failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create the share link." }, { status: 500 });
  }
}
