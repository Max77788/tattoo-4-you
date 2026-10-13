import { NextResponse } from "next/server";
import { del, list } from "@vercel/blob";
import { createHash, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

async function findShare(id: string) {
  const { blobs } = await list({ prefix: `tattoo-shares/${id}/share.json`, limit: 1 });
  if (!blobs.length) return null;
  const response = await fetch(blobs[0].url, { cache: "no-store" });
  if (!response.ok) return null;
  return { blob: blobs[0], record: await response.json() };
}

function validId(id: string) { return /^[0-9a-f-]{36}$/i.test(id); }

export async function GET(_request: Request, context: Context) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Public sharing is not configured." }, { status: 503 });
    const { id } = await context.params;
    if (!validId(id)) return NextResponse.json({ error: "Share not found." }, { status: 404 });
    const found = await findShare(id);
    if (!found) return NextResponse.json({ error: "Share not found." }, { status: 404 });
    const { deleteTokenHash: _private, ...publicRecord } = found.record;
    return NextResponse.json(publicRecord, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("Reading tattoo share failed", error);
    return NextResponse.json({ error: "Could not load this share." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ error: "Public sharing is not configured." }, { status: 503 });
    const { id } = await context.params;
    if (!validId(id)) return NextResponse.json({ error: "Share not found." }, { status: 404 });
    const body = await request.json();
    if (typeof body.deleteToken !== "string" || body.deleteToken.length !== 64) return NextResponse.json({ error: "Not authorized to delete this share." }, { status: 403 });
    const found = await findShare(id);
    if (!found) return NextResponse.json({ error: "Share not found." }, { status: 404 });
    const supplied = createHash("sha256").update(body.deleteToken).digest();
    const stored = Buffer.from(found.record.deleteTokenHash || "", "hex");
    if (stored.length !== supplied.length || !timingSafeEqual(supplied, stored)) return NextResponse.json({ error: "Not authorized to delete this share." }, { status: 403 });
    const { blobs } = await list({ prefix: `tattoo-shares/${id}/` });
    if (blobs.length) await del(blobs.map(blob => blob.url));
    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Deleting tattoo share failed", error);
    return NextResponse.json({ error: "Could not delete this share." }, { status: 500 });
  }
}
