"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Share = { id: string; bodyPart: string; requestText: string; person: string; tattoo: string; result: string; createdAt: string };

export default function SharedPreview() {
  const { id } = useParams<{ id: string }>();
  const [share, setShare] = useState<Share | null>(null);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [canDelete, setCanDelete] = useState(false);
  useEffect(() => {
    let active = true;
    fetch(`/api/shares/${id}`, { cache: "no-store" }).then(async r => {
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "This share could not be found.");
      if (active) setShare(data);
    }).catch(e => active && setError(e instanceof Error ? e.message : "This share could not be found."));
    setCanDelete(Boolean(localStorage.getItem(`tattoo-share-delete:${id}`)));
    return () => { active = false; };
  }, [id]);

  async function removeShare() {
    const token = localStorage.getItem(`tattoo-share-delete:${id}`);
    if (!token || !window.confirm("Permanently delete this public share and all its images? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/shares/${id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleteToken: token }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not delete this share.");
      localStorage.removeItem(`tattoo-share-delete:${id}`);
      setShare(null); setError("This share and its images have been deleted.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete this share."); }
    finally { setDeleting(false); }
  }

  return <main>
    <nav className="nav"><a className="brand" href="/" aria-label="Tattoo 4 You home"><span className="brand-mark">T4Y</span><span>TATTOO <b>4</b> YOU</span></a><span className="nav-note">SHARED PLACEMENT PREVIEW</span></nav>
    <section className="result shared-result"><div className="result-inner">
      <div className="result-head"><div><div className="eyebrow">A Tattoo 4 You preview</div><h1 className="shared-title">The idea,<br /><em>in place.</em></h1><p>A visual direction, not a final tattoo. Review the placement and discuss it with a professional tattoo artist.</p></div>{share && <a className="download" href={share.result} download="tattoo-4-you-preview.png">Download result ↓</a>}</div>
      {error && !share ? <p className="error-message" role="alert">{error}</p> : share && <>
        <div className="result-equation"><div className="equation-source"><div className="equation-label">PERSON PHOTO</div><div className="equation-thumb"><img src={share.person} alt="Shared person photo" /></div></div><div className="equation-symbol" aria-hidden="true">+</div><div className="equation-source"><div className="equation-label">TATTOO DESIGN</div><div className="equation-thumb tattoo-thumb"><img src={share.tattoo} alt="Shared tattoo design" /></div></div><div className="equation-symbol" aria-hidden="true">=</div><div className="equation-result"><div className="equation-label">PLACEMENT PREVIEW</div><div className="result-frame"><img src={share.result} alt={`Tattoo preview on ${share.bodyPart}`} /></div></div></div>
        <div className="result-footer"><span>PLACEMENT: {share.bodyPart.toUpperCase()}</span><span>{share.requestText ? `REQUEST: ${share.requestText}` : "SHARED TATTOO PREVIEW"}</span></div>
        {canDelete && <button className="delete-share" type="button" disabled={deleting} onClick={removeShare}>{deleting ? "DELETING…" : "Delete this public share"}</button>}
      </>}
    </div></section>
    <footer><div className="footer-brand"><span className="brand-mark">T4Y</span><strong>TATTOO 4 YOU</strong></div><span>AI PREVIEW · HUMAN ARTISTRY</span><a href="/">Create your own preview ↗</a></footer>
  </main>;
}
