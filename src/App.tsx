import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Config, ContentKind, Layout, LogoChoice, ModuleStyle } from "./qr/types";
import { BRAND_LOGOS, MARK, brandById, loadLogoInner } from "./qr/logos";
import { payloadFor, render, shortLabel, type LogoAsset } from "./qr/render";
import { embeddedFontStyle } from "./qr/fonts";
import { canvasToBlob, copyPng, download, slug, svgToCanvas } from "./qr/export";
import { verify, type ScanResult } from "./qr/verify";
import { Arrow, Field, Section, Seg, Slider, Swatches } from "./ui/controls";

const OFF_BLACK = "#1B1B1B";
const WHITE = "#FFFFFF";

const FG_OPTIONS = [
  { value: "#1B1B1B", label: "Off black" },
  { value: "#FFFFFF", label: "White" },
  { value: "#0988EF", label: "Blue" },
  { value: "#018848", label: "Green" },
];
const BG_OPTIONS = [
  { value: "#FFFFFF", label: "White" },
  { value: "#F5F5F5", label: "Surface" },
  { value: "#D0D2CC", label: "Beige" },
  { value: "#1B1B1B", label: "Off black" },
];
const EYE_OPTIONS = [
  { value: "#FF573B", label: "Red" },
  { value: "#018848", label: "Green" },
  { value: "#0988EF", label: "Blue" },
  { value: "#FEB800", label: "Yellow" },
];

const DEFAULT: Config = {
  content: {
    kind: "link",
    link: "https://www.owow.ventures/startup-investment-afternoon",
    text: "",
    email: "",
    emailSubject: "",
    phone: "",
    wifiSsid: "",
    wifiPassword: "",
    wifiSecurity: "WPA",
  },
  logo: { kind: "brand", id: "symbol-venture" },
  logoScale: 0.26,
  style: "square",
  fg: OFF_BLACK,
  bg: WHITE,
  eye: null,
  layout: "label",
  showMark: true,
  title: "Startup Investment Afternoon",
  subtitle: "Scan to apply",
  caption: "",
  footer: "OWOW® Venture Studio",
};

const PNG_SIZES = [1000, 2000, 4000];

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function App() {
  const [cfg, setCfg] = useState<Config>(DEFAULT);
  const [captionTouched, setCaptionTouched] = useState(false);
  const [markInner, setMarkInner] = useState<string>("");
  const [logoInner, setLogoInner] = useState<Record<string, string>>({});
  const [scan, setScan] = useState<ScanResult | "busy" | "idle">("idle");
  const [pngSize, setPngSize] = useState(2000);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((p: Partial<Config>) => setCfg((c) => ({ ...c, ...p })), []);
  const patchContent = useCallback((p: Partial<Config["content"]>) => setCfg((c) => ({ ...c, content: { ...c.content, ...p } })), []);

  // brand assets
  useEffect(() => {
    loadLogoInner(MARK.file).then(setMarkInner);
    for (const l of BRAND_LOGOS) loadLogoInner(l.file).then((inner) => setLogoInner((m) => ({ ...m, [l.id]: inner })));
  }, []);

  const payload = payloadFor(cfg.content);
  const effectiveCaption = captionTouched ? cfg.caption : cfg.content.kind === "link" && payload ? shortLabel(payload) : cfg.caption;

  const logoAsset: LogoAsset | null = useMemo(() => {
    if (cfg.logo.kind === "brand") {
      const b = brandById(cfg.logo.id);
      const inner = logoInner[cfg.logo.id];
      if (!b || !inner) return null;
      return { inner, w: b.w, h: b.h };
    }
    if (cfg.logo.kind === "custom") return { href: cfg.logo.dataUrl, w: cfg.logo.w, h: cfg.logo.h };
    return null;
  }, [cfg.logo, logoInner]);

  const rendered = useMemo(() => {
    if (!payload) return null;
    try {
      return render({ ...cfg, caption: effectiveCaption }, { logo: logoAsset, mark: markInner });
    } catch {
      return null;
    }
  }, [cfg, effectiveCaption, logoAsset, markInner, payload]);

  // scan check, debounced
  const debouncedSvg = useDebounced(rendered?.svg ?? "", 450);
  useEffect(() => {
    if (!rendered || !debouncedSvg) {
      setScan("idle");
      return;
    }
    let cancelled = false;
    setScan("busy");
    verify(debouncedSvg, rendered.width, rendered.height, rendered.payload, cfg.bg === "transparent")
      .then((r) => !cancelled && setScan(r))
      .catch(() => !cancelled && setScan("fail"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSvg]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const pickBrand = (id: string) => {
    const b = brandById(id)!;
    patch({ logo: { kind: "brand", id }, logoScale: b.group === "symbol" ? 0.26 : b.group === "mark" ? 0.4 : 0.48 });
  };

  const onUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 100;
        const h = img.naturalHeight || 100;
        const logo: LogoChoice = { kind: "custom", dataUrl, w, h, name: file.name };
        patch({ logo, logoScale: w / h > 2 ? 0.44 : 0.26 });
      };
      img.onerror = () => setToast("could not read that image");
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const exportSvg = async (): Promise<string | null> => {
    if (!rendered) return null;
    const fontStyle = await embeddedFontStyle();
    return render({ ...cfg, caption: effectiveCaption }, { logo: logoAsset, mark: markInner, fontStyle }).svg;
  };

  const baseName = () => `owow-qr-${slug(payload)}-${cfg.layout}`;

  const doPng = async (copy = false) => {
    if (!rendered) return;
    setBusy(true);
    try {
      const svg = await exportSvg();
      if (!svg) return;
      const canvas = await svgToCanvas(svg, rendered.width, rendered.height, pngSize);
      const blob = await canvasToBlob(canvas);
      const name = `${baseName()}-${pngSize}px.png`;
      if (copy) {
        if (await copyPng(blob)) setToast("copied to clipboard");
        else {
          setToast("clipboard blocked, downloaded instead");
          download(blob, name);
        }
      } else download(blob, name);
    } finally {
      setBusy(false);
    }
  };

  const doSvg = async () => {
    if (!rendered) return;
    setBusy(true);
    try {
      const svg = await exportSvg();
      if (svg) download(new Blob([svg], { type: "image/svg+xml" }), `${baseName()}.svg`);
    } finally {
      setBusy(false);
    }
  };

  const transparent = cfg.bg === "transparent";
  const coveragePct = rendered ? Math.round(rendered.coverage * 100) : 0;

  return (
    <>
      <header className="header">
        <div className="brand">
          <img src={`${import.meta.env.BASE_URL}logos/owow-logomark-overall.svg`} alt="OWOW®" style={{ color: "#0E0E0E" }} />
          <span className="eyebrow">(qr studio)</span>
        </div>
        <nav>
          <a className="btn" href="https://www.owow.io" target="_blank" rel="noreferrer">
            owow.io <Arrow />
          </a>
        </nav>
      </header>

      <div className="hero">
        <span className="eyebrow muted">(static codes, never expire)</span>
        <h1>Branded QR codes. Ready to print in seconds.</h1>
        <p>Paste a link, pick a logo, pick a look. Everything is generated in your browser and exported as PNG or SVG. No account, no link shortener, nothing that can go dark on you.</p>
      </div>

      <main className="studio">
        <div className="controls">
          <Section index="01" title="Content">
            <div className="stack">
              <Seg<ContentKind>
                ariaLabel="Content type"
                value={cfg.content.kind}
                onChange={(kind) => patchContent({ kind })}
                options={[
                  { value: "link", label: "link" },
                  { value: "text", label: "text" },
                  { value: "email", label: "email" },
                  { value: "phone", label: "phone" },
                  { value: "wifi", label: "wifi" },
                ]}
              />
              {cfg.content.kind === "link" && (
                <Field label="url" hint={payload ? `encodes ${payload}` : "paste a link"}>
                  <input value={cfg.content.link} onChange={(e) => patchContent({ link: e.target.value })} placeholder="owow.io/something" spellCheck={false} />
                </Field>
              )}
              {cfg.content.kind === "text" && (
                <Field label="text">
                  <textarea value={cfg.content.text} onChange={(e) => patchContent({ text: e.target.value })} placeholder="Anything you want people to read after scanning" />
                </Field>
              )}
              {cfg.content.kind === "email" && (
                <div className="row">
                  <Field label="to">
                    <input value={cfg.content.email} onChange={(e) => patchContent({ email: e.target.value })} placeholder="new@owow.io" />
                  </Field>
                  <Field label="subject (optional)">
                    <input value={cfg.content.emailSubject} onChange={(e) => patchContent({ emailSubject: e.target.value })} placeholder="Let's build something" />
                  </Field>
                </div>
              )}
              {cfg.content.kind === "phone" && (
                <Field label="phone number">
                  <input value={cfg.content.phone} onChange={(e) => patchContent({ phone: e.target.value })} placeholder="+31 40 000 0000" />
                </Field>
              )}
              {cfg.content.kind === "wifi" && (
                <div className="row">
                  <Field label="network name">
                    <input value={cfg.content.wifiSsid} onChange={(e) => patchContent({ wifiSsid: e.target.value })} />
                  </Field>
                  <Field label="password">
                    <input value={cfg.content.wifiPassword} onChange={(e) => patchContent({ wifiPassword: e.target.value })} />
                  </Field>
                  <Field label="security">
                    <select value={cfg.content.wifiSecurity} onChange={(e) => patchContent({ wifiSecurity: e.target.value as Config["content"]["wifiSecurity"] })}>
                      <option value="WPA">WPA / WPA2</option>
                      <option value="WEP">WEP</option>
                      <option value="nopass">open</option>
                    </select>
                  </Field>
                </div>
              )}
            </div>
          </Section>

          <Section index="02" title="Logo" aside={cfg.logo.kind !== "none" ? <span className="eyebrow muted">covers {coveragePct}% of the code</span> : null}>
            <div className="stack">
              <div className="logo-grid">
                <button type="button" className="tile none" aria-pressed={cfg.logo.kind === "none"} onClick={() => patch({ logo: { kind: "none" } })}>
                  no logo
                </button>
                {BRAND_LOGOS.map((l) => (
                  <button key={l.id} type="button" className="tile" title={l.label} aria-pressed={cfg.logo.kind === "brand" && cfg.logo.id === l.id} onClick={() => pickBrand(l.id)} style={{ color: "#1B1B1B" }}>
                    <img src={`${import.meta.env.BASE_URL}logos/${l.file}`} alt={l.label} />
                    <span className="tile-label">{l.short}</span>
                  </button>
                ))}
                <button type="button" className="tile upload" aria-pressed={cfg.logo.kind === "custom"} onClick={() => fileRef.current?.click()}>
                  {cfg.logo.kind === "custom" ? <img src={cfg.logo.dataUrl} alt={cfg.logo.name} /> : <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>}
                  <span className="tile-label">{cfg.logo.kind === "custom" ? cfg.logo.name : "upload your own"}</span>
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUpload(f);
                    e.target.value = "";
                  }}
                />
              </div>
              {cfg.logo.kind !== "none" && (
                <div className="row">
                  <Slider label="size" min={0.14} max={0.52} step={0.01} value={cfg.logoScale} onChange={(v) => patch({ logoScale: v })} format={(v) => `${Math.round(v * 100)}%`} />
                </div>
              )}
              {cfg.logo.kind === "custom" && <span className="notice">Tip: a simple, high contrast logo scans best. PNG with transparency or SVG.</span>}
            </div>
          </Section>

          <Section index="03" title="Look">
            <div className="stack">
              <div className="row">
                <Seg<ModuleStyle>
                  ariaLabel="Module style"
                  value={cfg.style}
                  onChange={(style) => patch({ style })}
                  options={[
                    { value: "square", label: "square" },
                    { value: "rounded", label: "rounded" },
                    { value: "dots", label: "dots" },
                  ]}
                />
              </div>
              <div className="row" style={{ gap: 24 }}>
                <Field label="code">
                  <Swatches ariaLabel="Foreground colour" value={cfg.fg} options={FG_OPTIONS} onChange={(fg) => patch({ fg })} />
                </Field>
                <Field label="background">
                  <Swatches ariaLabel="Background colour" value={cfg.bg} options={BG_OPTIONS} onChange={(bg) => patch({ bg })} allowTransparent />
                </Field>
                <Field label="eye accent">
                  <div className="swatches">
                    <button type="button" className="swatch" title="None" aria-label="No accent" aria-pressed={cfg.eye === null} style={{ background: "#fff" }} onClick={() => patch({ eye: null })} />
                    {EYE_OPTIONS.map((o) => (
                      <button key={o.value} type="button" className="swatch" title={o.label} aria-label={o.label} aria-pressed={cfg.eye === o.value} style={{ background: o.value }} onClick={() => patch({ eye: o.value })} />
                    ))}
                  </div>
                </Field>
              </div>
              {cfg.fg.toLowerCase() === cfg.bg.toLowerCase() && <span className="notice warn">Code and background are the same colour. Nothing will scan.</span>}
            </div>
          </Section>

          <Section index="04" title="Layout">
            <div className="stack">
              <Seg<Layout>
                ariaLabel="Layout"
                value={cfg.layout}
                onChange={(layout) => patch({ layout })}
                options={[
                  { value: "plain", label: "code only" },
                  { value: "label", label: "with label" },
                  { value: "card", label: "poster card" },
                ]}
              />
              {cfg.layout !== "plain" && (
                <label className="row" style={{ gap: 10, fontFamily: "var(--font-mono)", fontSize: 13 }}>
                  <input type="checkbox" checked={cfg.showMark} onChange={(e) => patch({ showMark: e.target.checked })} style={{ accentColor: "var(--fg)" }} />
                  show the OWOW® mark
                </label>
              )}
              {cfg.layout === "card" && (
                <div className="row">
                  <Field label="title">
                    <input value={cfg.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Startup Investment Afternoon" />
                  </Field>
                  <Field label="subtitle">
                    <input value={cfg.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="Scan to apply" />
                  </Field>
                </div>
              )}
              {cfg.layout !== "plain" && (
                <div className="row">
                  <Field label={cfg.layout === "card" ? "footer left" : "caption"}>
                    <input
                      value={effectiveCaption}
                      onChange={(e) => {
                        setCaptionTouched(true);
                        patch({ caption: e.target.value });
                      }}
                      placeholder="owow.io"
                    />
                  </Field>
                  {cfg.layout === "card" && (
                    <Field label="footer right">
                      <input value={cfg.footer} onChange={(e) => patch({ footer: e.target.value })} placeholder="OWOW® Venture Studio" />
                    </Field>
                  )}
                </div>
              )}
            </div>
          </Section>
        </div>

        <div className="preview-col">
          <div className="preview-sticky">
            <div className={`preview${transparent ? " checker" : ""}`}>
              <div className="preview-meta">
                <span>
                  {rendered ? `${rendered.width} × ${rendered.height} · ${rendered.modules} modules · level H` : "waiting for content"}
                </span>
                <span className={`scan ${scan === "ok" ? "ok" : scan === "fail" || scan === "mismatch" ? "fail" : scan === "busy" ? "busy" : ""}`}>
                  <i />
                  {scan === "ok" ? "scans" : scan === "busy" ? "checking" : scan === "fail" ? "does not scan, shrink the logo" : scan === "mismatch" ? "decodes wrong, shrink the logo" : "no code"}
                </span>
              </div>
              {rendered ? (
                <div className="frame" dangerouslySetInnerHTML={{ __html: rendered.svg }} />
              ) : (
                <span className="mono muted">Add some content to see your code.</span>
              )}
            </div>

            <div className="export">
              <div className="row">
                <Seg<string> ariaLabel="PNG size" value={String(pngSize)} onChange={(v) => setPngSize(Number(v))} options={PNG_SIZES.map((s) => ({ value: String(s), label: `${s} px` }))} />
              </div>
              <div className="row">
                <button type="button" className="btn" disabled={!rendered || busy} onClick={() => doPng(true)}>
                  copy png
                </button>
                <button type="button" className="btn" disabled={!rendered || busy} onClick={doSvg}>
                  download svg
                </button>
                <button type="button" className="btn primary" disabled={!rendered || busy} onClick={() => doPng(false)}>
                  download png <Arrow />
                </button>
              </div>
            </div>
            <span className="notice">
              {pngSize === 4000 ? "4000 px prints an A2 poster crisp." : pngSize === 2000 ? "2000 px is plenty for flyers and A4." : "1000 px is for screens and slides."} SVG is vector and scales to anything.
            </span>
          </div>
        </div>
      </main>

      <footer className="footer">
        <span>OWOW® ©2026 · Fuutlaan 14E, Eindhoven</span>
        <span>codes are generated locally, nothing is uploaded</span>
      </footer>

      {toast ? <div className="toast">{toast}</div> : null}
    </>
  );
}
