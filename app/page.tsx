"use client";

import { useMemo, useRef, useState } from "react";

const bodyParts = [
  "Head / scalp", "Forehead", "Temple", "Behind the ear", "Ear", "Neck front", "Neck side", "Nape of neck", "Throat",
  "Shoulder cap - left", "Shoulder cap - right", "Collarbone - left", "Collarbone - right", "Chest - left", "Chest - right", "Center chest", "Upper sternum", "Rib cage - left", "Rib cage - right", "Side ribs - left", "Side ribs - right", "Underarm - left", "Underarm - right", "Upper back", "Shoulder blade - left", "Shoulder blade - right", "Spine / back center", "Lower back", "Hip - left", "Hip - right", "Side waist - left", "Side waist - right", "Belly / abdomen", "Navel area", "Stomach - left", "Stomach - right",
  "Upper arm - left outer", "Upper arm - left inner", "Upper arm - right outer", "Upper arm - right inner", "Bicep - left", "Bicep - right", "Tricep - left", "Tricep - right", "Elbow - left", "Elbow - right", "Elbow ditch - left", "Elbow ditch - right", "Forearm - left outer", "Forearm - left inner", "Forearm - right outer", "Forearm - right inner", "Wrist - left top", "Wrist - left underside", "Wrist - right top", "Wrist - right underside", "Back of hand - left", "Back of hand - right", "Palm - left", "Palm - right", "Knuckle - left", "Knuckle - right", "Finger - left index", "Finger - left middle", "Finger - left ring", "Finger - left pinky", "Finger - right index", "Finger - right middle", "Finger - right ring", "Finger - right pinky",
  "Thigh - left front", "Thigh - left outer", "Thigh - left inner", "Thigh - left back", "Thigh - right front", "Thigh - right outer", "Thigh - right inner", "Thigh - right back", "Knee - left front", "Knee - right front", "Knee ditch - left", "Knee ditch - right", "Calf - left outer", "Calf - left inner", "Calf - left back", "Calf - right outer", "Calf - right inner", "Calf - right back", "Shin - left", "Shin - right", "Ankle - left outer", "Ankle - left inner", "Ankle - right outer", "Ankle - right inner", "Top of foot - left", "Top of foot - right", "Sole of foot - left", "Sole of foot - right", "Toe - left big", "Toe - right big"
];

type UploadCardProps = { label: string; hint: string; file: File | null; onFile: (file: File | null) => void; accent?: boolean };
function UploadCard({ label, hint, file, onFile, accent }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <button type="button" className={`upload-card ${file ? "has-file" : ""} ${accent ? "accent" : ""}`} onClick={() => inputRef.current?.click()}>
    <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => onFile(e.target.files?.[0] ?? null)} />
    <span className="upload-icon">{file ? "✓" : "+"}</span><span className="upload-label">{file ? file.name : label}</span><span className="upload-hint">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · ready` : hint}</span>
  </button>;
}

export default function Home() {
  const [person, setPerson] = useState<File | null>(null);
  const [tattoo, setTattoo] = useState<File | null>(null);
  const [query, setQuery] = useState("");
  const [part, setPart] = useState("");
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const matches = useMemo(() => bodyParts.filter(item => item.toLowerCase().includes(query.toLowerCase())).slice(0, 18), [query]);

  async function prepareImage(file: File, maxDimension = 1600) {
    const source = await createImageBitmap(file);
    const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")?.drawImage(source, 0, 0, width, height);
    source.close();
    const compressed = canvas.toDataURL("image/webp", 0.82);
    if (!compressed.startsWith("data:image/webp")) {
      return canvas.toDataURL("image/jpeg", 0.82);
    }
    return compressed;
  }

  async function visualize() {
    if (!person || !tattoo || !part) { setError("Add both photos and choose the exact body part first."); return; }
    setBusy(true); setError(""); setResult(null);
    try {
      const [personImage, tattooImage] = await Promise.all([prepareImage(person, 1600), prepareImage(tattoo, 1400)]);
      const response = await fetch("/api/visualize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ person: personImage, tattoo: tattooImage, bodyPart: part }) });
      const raw = await response.text();
      let data: { image?: string; error?: string } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: response.status === 413 ? "The images are still too large. Please choose smaller photos." : `The preview service returned an unexpected response (${response.status}).` }; }
      if (!response.ok) throw new Error(data.error || "Could not create the preview.");
      if (!data.image) throw new Error("The preview service returned no image. Try again with clearer photos.");
      setResult(data.image);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Try again."); } finally { setBusy(false); }
  }
  return <main>
    <nav className="nav"><div className="brand"><span className="brand-mark">T4Y</span><span>TATTOO <b>4</b> YOU</span></div><span className="nav-note">AI-powered placement preview</span></nav>
    <section className="hero"><div className="eyebrow">Before the needle</div><h1>See your ink.<br /><em>Feel the fit.</em></h1><p className="hero-copy">Your tattoo. Your body. No guesswork.<br />Upload two photos and preview the design in its exact place.</p><div className="scroll-cue">BUILD YOUR PREVIEW <span>↓</span></div></section>
    <section className="builder" id="builder"><div className="step-row"><span><i>01</i> YOUR PHOTOS</span><span><i>02</i> PLACEMENT</span><span><i>03</i> YOUR PREVIEW</span></div><div className="form-grid"><div className="photo-column"><div className="section-title"><span className="number">01</span><div><h2>Bring the references.</h2><p>Use a clear photo with the body area visible.</p></div></div><div className="uploads"><UploadCard label="Upload your photo" hint="Full body or the area you want to see" file={person} onFile={setPerson} accent /><UploadCard label="Upload tattoo design" hint="PNG with transparency works best" file={tattoo} onFile={setTattoo} /></div><p className="privacy"><span>✦</span> Your images are used only to create this preview and are never stored.</p></div><div className="placement-column"><div className="section-title"><span className="number">02</span><div><h2>Choose the canvas.</h2><p>Search 100+ precise placement options.</p></div></div><div className="combobox"><input value={query || part} onChange={e => { setQuery(e.target.value); setPart(""); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search body parts..." aria-label="Search body parts" /><span>⌄</span>{open && <div className="options">{matches.length ? matches.map(item => <button type="button" key={item} onClick={() => { setPart(item); setQuery(""); setOpen(false); }}>{item}</button>) : <p>No placements found</p>}</div>}</div>{part && <div className="selected"><span>SELECTED PLACEMENT</span><strong>{part}</strong><button type="button" onClick={() => setPart("")}>×</button></div>}<div className="placement-note"><span>◎</span><p><b>Placement matters.</b> We preserve the design, scale it naturally, and blend it into the perspective, lighting, and skin of your photo.</p></div></div></div><button type="button" className="generate" onClick={visualize} disabled={busy}>{busy ? <><span className="spinner" /> COMPOSING YOUR PREVIEW...</> : <>SHOW ME THE INK <span>→</span></>}</button>{error && <div className="error">{error}</div>}</section>
    {result && <section className="result"><div className="result-head"><div><div className="eyebrow">03 · Your preview</div><h2>Here is how it could look.</h2><p>A visual direction, not a final tattoo. Talk to your artist about scale and placement.</p></div><a className="download" href={result} download="tattoo-4-you-preview.png">DOWNLOAD IMAGE ↓</a></div><div className="result-frame"><img src={result} alt={`Tattoo preview on ${part}`} /></div></section>}
    <footer><span>© 2026 TATTOO 4 YOU</span><span>DESIGNED FOR THE DECISIVE</span><span>AI PREVIEW · HUMAN ARTISTRY</span></footer>
  </main>;
}
