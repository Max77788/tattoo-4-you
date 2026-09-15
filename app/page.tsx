"use client";

import { useEffect, useRef, useState } from "react";

const placementSuggestions = [
  "outer right forearm",
  "inner left forearm",
  "left side of neck",
  "upper back between the shoulder blades",
  "right shoulder cap",
  "left rib cage",
  "front of right thigh",
  "right ankle",
];

type UploadCardProps = {
  label: string;
  hint: string;
  file: File | null;
  onFile: (file: File | null) => void;
  accent?: boolean;
};

function UploadCard({ label, hint, file, onFile, accent }: UploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      className={`upload-card ${file ? "has-file" : ""} ${accent ? "accent" : ""}`}
      onClick={() => inputRef.current?.click()}
      aria-label={file ? `Replace ${label}: ${file.name}` : label}
    >
      <input ref={inputRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={e => onFile(e.target.files?.[0] ?? null)} />
      <span className="upload-topline"><span className="upload-icon">{file ? "✓" : "+"}</span><span>{file ? "Ready to use" : "Add image"}</span></span>
      <span className="upload-label">{file ? file.name : label}</span>
      <span className="upload-hint">{file ? `${(file.size / 1024 / 1024).toFixed(1)} MB · tap to replace` : hint}</span>
    </button>
  );
}

function useFileUrl(file: File | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return url;
}

export default function Home() {
  const [person, setPerson] = useState<File | null>(null);
  const [tattoo, setTattoo] = useState<File | null>(null);
  const [part, setPart] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const resultRef = useRef<HTMLElement>(null);
  const builderRef = useRef<HTMLElement>(null);
  const personPreview = useFileUrl(person);
  const tattooPreview = useFileUrl(tattoo);
  const step = result ? 3 : part ? 2 : person || tattoo ? 1 : 1;

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

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
    return compressed.startsWith("data:image/webp") ? compressed : canvas.toDataURL("image/jpeg", 0.82);
  }

  async function visualize() {
    if (!person || !tattoo || !part.trim()) {
      setError("Add both images and describe the exact placement to continue.");
      builderRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setBusy(true); setError(""); setResult(null);
    try {
      const [personImage, tattooImage] = await Promise.all([prepareImage(person, 1600), prepareImage(tattoo, 1400)]);
      const response = await fetch("/api/visualize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ person: personImage, tattoo: tattooImage, bodyPart: part.trim() }) });
      const raw = await response.text();
      let data: { image?: string; error?: string } = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { error: response.status === 413 ? "The images are still too large. Please choose smaller photos." : `The preview service returned an unexpected response (${response.status}).` }; }
      if (!response.ok) throw new Error(data.error || "Could not create the preview.");
      if (!data.image) throw new Error("The preview service returned no image. Try again with clearer photos.");
      setResult(data.image);
    } catch (err) { setError(err instanceof Error ? err.message : "Something went wrong. Try again."); } finally { setBusy(false); }
  }

  return <main>
    <nav className="nav" aria-label="Primary navigation">
      <a className="brand" href="#top" aria-label="Tattoo 4 You home"><span className="brand-mark">T4Y</span><span>TATTOO <b>4</b> YOU</span></a>
      <div className="nav-right"><span className="nav-note">AI PLACEMENT PREVIEW</span><a className="nav-cta" href="#builder">Start a preview <span>↘</span></a></div>
    </nav>

    <section className="hero" id="top">
      <div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" />
      <div className="hero-content"><div className="eyebrow">A better way to commit</div><h1>Make the idea<br /><em>feel real.</em></h1><p className="hero-copy">See your tattoo on your body before the needle touches skin. Upload a photo, add your design, and get a realistic placement preview in minutes.</p><button className="hero-button" type="button" onClick={() => builderRef.current?.scrollIntoView({ behavior: "smooth" })}>Build my preview <span>↓</span></button></div>
      <div className="hero-proof"><span className="proof-dot" /><span>Private by design</span><span className="proof-separator">/</span><span>Human artistry, AI-assisted</span></div>
    </section>

    <section className="builder" id="builder" ref={builderRef}>
      <div className="progress-bar"><div className={`progress-line progress-${step}`} /><div className={`progress-step ${step >= 1 ? "active" : ""}`}><span>01</span><b>Reference</b></div><div className={`progress-step ${step >= 2 ? "active" : ""}`}><span>02</span><b>Placement</b></div><div className={`progress-step ${step >= 3 ? "active" : ""}`}><span>03</span><b>Preview</b></div></div>
      <div className="builder-intro"><div><div className="eyebrow">Your private fitting room</div><h2>Let&apos;s place your idea.</h2></div><p>Two images and one clear description are all we need. You stay in control at every step.</p></div>
      <div className="form-grid">
        <div className="photo-column"><div className="section-title"><span className="number">01</span><div><h3>Bring the references.</h3><p>Use a clear, well-lit photo with the area visible.</p></div></div><div className="uploads"><UploadCard label="Your body photo" hint="Full body or the area you want to see" file={person} onFile={setPerson} accent /><UploadCard label="Your tattoo design" hint="A PNG with transparency works best" file={tattoo} onFile={setTattoo} /></div><div className="micro-trust"><span>✦</span><div><b>Your images stay yours.</b><br />They are used only to create this preview and are never stored.</div></div></div>
        <div className="placement-column"><div className="section-title"><span className="number">02</span><div><h3>Name the canvas.</h3><p>Specific placement creates a more useful preview.</p></div></div><label className="field-label" htmlFor="placement">Where should the tattoo go?</label><div className="combobox"><input id="placement" list="placement-suggestions" value={part} onChange={e => setPart(e.target.value)} placeholder="e.g. outer right forearm" autoComplete="off" /><span>⌕</span></div><datalist id="placement-suggestions">{placementSuggestions.map(s => <option key={s} value={s} />)}</datalist><div className="quick-picks"><span>Try</span>{placementSuggestions.slice(0, 3).map(s => <button key={s} type="button" onClick={() => setPart(s)}>{s}</button>)}</div><div className="placement-note"><span>◎</span><p><b>Think like an artist.</b> Include the side, surface, and a nearby landmark. We&apos;ll preserve your design and blend it into the perspective, lighting, and skin.</p></div></div>
      </div>
      {error && <div className="error-message" role="alert"><span>!</span>{error}</div>}
      <div className="generate-row"><button type="button" className="generate" onClick={visualize} disabled={busy}>{busy ? <><span className="spinner" /> COMPOSING YOUR PREVIEW...</> : <>SHOW ME THE INK <span>→</span></>}</button><span className="generate-note">Usually ready in under a minute<br />No account required</span></div>
    </section>

    {result && <section ref={resultRef} className="result"><div className="result-inner"><div className="result-head"><div><div className="eyebrow">03 · Your private preview</div><h2>Now make the call<br /><em>with confidence.</em></h2><p>A visual direction, not a final tattoo. Take it to your artist and refine the scale, flow, and placement together.</p></div><a className="download" href={result} download="tattoo-4-you-preview.png">Download image <span>↓</span></a></div><div className="result-equation"><div className="equation-source"><div className="equation-label">YOUR PHOTO</div><div className="equation-thumb">{personPreview && <img src={personPreview} alt="Original person photo" />}</div></div><div className="equation-symbol" aria-hidden="true">+</div><div className="equation-source"><div className="equation-label">YOUR DESIGN</div><div className="equation-thumb tattoo-thumb">{tattooPreview && <img src={tattooPreview} alt="Uploaded tattoo design" />}</div></div><div className="equation-symbol" aria-hidden="true">=</div><div className="equation-result"><div className="equation-label">THE POSSIBILITY</div><div className="result-frame"><img src={result} alt={`Tattoo preview on ${part}`} /></div></div></div><div className="result-footer"><span>PLACEMENT: {part.toUpperCase()}</span><button type="button" onClick={() => { setResult(null); builderRef.current?.scrollIntoView({ behavior: "smooth" }); }}>Try another placement ↗</button></div></div></section>}

    <footer><div className="footer-brand"><span className="brand-mark">T4Y</span><strong>TATTOO 4 YOU</strong></div><span>AI PREVIEW · HUMAN ARTISTRY</span><span>© 2026 TATTOO 4 YOU</span></footer>
  </main>;
}
