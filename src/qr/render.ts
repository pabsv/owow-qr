import qrcode from "qrcode-generator";
import type { Config, Content, Rendered } from "./types";
import { brandById, MARK } from "./logos";

export const FONT_SANS = "Switzer, 'PP Neue Montreal', 'Segoe UI', system-ui, sans-serif";
export const FONT_MONO = "'JetBrains Mono', 'PP Neue Montreal Mono', Consolas, monospace";

/** Data actually written into the code. */
export function payloadFor(c: Content): string {
  switch (c.kind) {
    case "link": {
      const v = c.link.trim();
      if (!v) return "";
      return /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
    }
    case "text":
      return c.text;
    case "email": {
      const to = c.email.trim();
      if (!to) return "";
      const subj = c.emailSubject.trim();
      return `mailto:${to}${subj ? `?subject=${encodeURIComponent(subj)}` : ""}`;
    }
    case "phone": {
      const v = c.phone.replace(/[^\d+]/g, "");
      return v ? `tel:${v}` : "";
    }
    case "wifi": {
      const esc = (s: string) => s.replace(/([\\;,:"])/g, "\\$1");
      if (!c.wifiSsid.trim()) return "";
      const t = c.wifiSecurity;
      return `WIFI:T:${t};S:${esc(c.wifiSsid)};${t === "nopass" ? "" : `P:${esc(c.wifiPassword)};`};`;
    }
  }
}

export function shortLabel(payload: string): string {
  return payload.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export function matrixFor(payload: string): boolean[][] {
  const qr = qrcode(0, "H");
  qr.addData(payload || " ", "Byte");
  qr.make();
  const n = qr.getModuleCount();
  const m: boolean[][] = [];
  for (let r = 0; r < n; r++) {
    const row: boolean[] = [];
    for (let c = 0; c < n; c++) row.push(qr.isDark(r, c));
    m.push(row);
  }
  return m;
}

const f = (v: number) => (Math.round(v * 1000) / 1000).toString();

function rrect(x: number, y: number, w: number, h: number, r: number): string {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) return `M${f(x)},${f(y)} h${f(w)} v${f(h)} h${f(-w)} z`;
  return (
    `M${f(x + r)},${f(y)} h${f(w - 2 * r)} a${f(r)},${f(r)} 0 0 1 ${f(r)},${f(r)} ` +
    `v${f(h - 2 * r)} a${f(r)},${f(r)} 0 0 1 ${f(-r)},${f(r)} h${f(-(w - 2 * r))} ` +
    `a${f(r)},${f(r)} 0 0 1 ${f(-r)},${f(-r)} v${f(-(h - 2 * r))} a${f(r)},${f(r)} 0 0 1 ${f(r)},${f(-r)} z`
  );
}

function inFinder(r: number, c: number, n: number): boolean {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}

export interface LogoAsset {
  inner?: string; // brand: inline markup using currentColor
  href?: string; // custom: data url
  w: number;
  h: number;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

interface QrOut {
  markup: string;
  coverage: number;
}

/** QR modules plus centred logo knockout, positioned at (x, y) with the given size. */
function qrGroup(m: boolean[][], x: number, y: number, size: number, cfg: Config, logo: LogoAsset | null): QrOut {
  const n = m.length;
  const ms = size / n;
  const parts: string[] = [`<g transform="translate(${f(x)},${f(y)})"${cfg.style === "square" ? ' shape-rendering="crispEdges"' : ""}>`];
  const fg = cfg.fg;

  // logo knockout box (in modules), always odd so it stays centred
  let kw = 0;
  let kh = 0;
  if (logo) {
    const aspect = logo.w / logo.h;
    kw = Math.round(n * cfg.logoScale);
    kh = Math.round(kw / aspect);
    if (aspect < 1) {
      kh = Math.round(n * cfg.logoScale);
      kw = Math.round(kh * aspect);
    }
    kw = Math.max(5, kw) | 1;
    kh = Math.max(3, kh) | 1;
    kw = Math.min(kw, n - 18);
    kh = Math.min(kh, n - 18);
  }
  const c = (n - 1) / 2;
  const c0 = c - (kw - 1) / 2;
  const c1 = c + (kw - 1) / 2;
  const r0 = c - (kh - 1) / 2;
  const r1 = c + (kh - 1) / 2;
  const inKnockout = (r: number, col: number) => logo !== null && r >= r0 && r <= r1 && col >= c0 && col <= c1;

  // finder patterns drawn as shapes so eyes can take an accent colour
  const radii = cfg.style === "dots" ? [2.2, 1.4, 0.9] : cfg.style === "rounded" ? [1.4, 0.9, 0.55] : [0, 0, 0];
  for (const [fr, fc] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ]) {
    const ox = fc * ms;
    const oy = fr * ms;
    const outer = rrect(ox, oy, 7 * ms, 7 * ms, radii[0] * ms);
    const inner = rrect(ox + ms, oy + ms, 5 * ms, 5 * ms, radii[1] * ms);
    const eye = rrect(ox + 2 * ms, oy + 2 * ms, 3 * ms, 3 * ms, radii[2] * ms);
    parts.push(`<path d="${outer} ${inner}" fill="${fg}" fill-rule="evenodd"/>`);
    parts.push(`<path d="${eye}" fill="${cfg.eye ?? fg}"/>`);
  }

  const dotR = ms * 0.45;
  const rx = cfg.style === "rounded" ? ms * 0.32 : 0;
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      if (!m[r][col] || inFinder(r, col, n) || inKnockout(r, col)) continue;
      if (cfg.style === "dots") {
        parts.push(`<circle cx="${f((col + 0.5) * ms)}" cy="${f((r + 0.5) * ms)}" r="${f(dotR)}" fill="${fg}"/>`);
      } else if (cfg.style === "rounded") {
        parts.push(`<rect x="${f(col * ms + 0.04 * ms)}" y="${f(r * ms + 0.04 * ms)}" width="${f(ms * 0.92)}" height="${f(ms * 0.92)}" rx="${f(rx)}" fill="${fg}"/>`);
      } else {
        parts.push(`<rect x="${f(col * ms)}" y="${f(r * ms)}" width="${f(ms + 0.06)}" height="${f(ms + 0.06)}" fill="${fg}"/>`);
      }
    }
  }

  let coverage = 0;
  if (logo) {
    coverage = (kw * kh) / (n * n);
    const pad = 0.9 * ms;
    const boxW = kw * ms - 2 * pad;
    const boxH = kh * ms - 2 * pad;
    const s = Math.min(boxW / logo.w, boxH / logo.h);
    const lw = logo.w * s;
    const lh = logo.h * s;
    const lx = c0 * ms + pad + (boxW - lw) / 2;
    const ly = r0 * ms + pad + (boxH - lh) / 2;
    if (logo.inner) {
      parts.push(`<g transform="translate(${f(lx)},${f(ly)}) scale(${f(s)})" fill="${fg}" color="${fg}">${logo.inner.replace(/currentColor/g, fg)}</g>`);
    } else if (logo.href) {
      parts.push(`<image x="${f(lx)}" y="${f(ly)}" width="${f(lw)}" height="${f(lh)}" href="${logo.href}" preserveAspectRatio="xMidYMid meet"/>`);
    }
  }
  parts.push("</g>");
  return { markup: parts.join(""), coverage };
}

function placeMark(x: number, y: number, width: number, color: string, inner: string): { markup: string; h: number } {
  const s = width / MARK.w;
  return {
    markup: `<g transform="translate(${f(x)},${f(y)}) scale(${f(s)})" fill="${color}">${inner.replace(/currentColor/g, color)}</g>`,
    h: MARK.h * s,
  };
}

function text(x: number, y: number, s: string, size: number, fill: string, opts: { anchor?: string; mono?: boolean; weight?: number; ls?: number; opacity?: number } = {}): string {
  if (!s) return "";
  return (
    `<text x="${f(x)}" y="${f(y)}" font-family="${opts.mono ? FONT_MONO : FONT_SANS}" font-size="${size}" ` +
    `font-weight="${opts.weight ?? 400}" fill="${fill}" text-anchor="${opts.anchor ?? "start"}" ` +
    `letter-spacing="${opts.ls ?? 0}"${opts.opacity !== undefined ? ` fill-opacity="${opts.opacity}"` : ""}>${esc(s)}</text>`
  );
}

let measureCtx: CanvasRenderingContext2D | null = null;
function measure(s: string, font: string): number {
  if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
  if (!measureCtx) return s.length * 0.5 * 78;
  measureCtx.font = font;
  return measureCtx.measureText(s).width;
}

/** Word wrap using real font metrics from the page (falls back to a width estimate). */
export function wrap(s: string, size: number, maxWidth: number): string[] {
  const font = `400 ${size}px ${FONT_SANS}`;
  const lines: string[] = [];
  for (const para of s.split("\n")) {
    const words = para.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (measure(next, font) <= maxWidth || !cur) cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    lines.push(cur);
  }
  return lines.length ? lines : [""];
}

export interface Assets {
  logo: LogoAsset | null;
  mark: string; // inner markup of the OWOW mark
  fontStyle?: string; // <style> block with embedded fonts, export only
}

function mutedOf(cfg: Config): string {
  return cfg.fg;
}

export function render(cfg: Config, assets: Assets): Rendered {
  const payload = payloadFor(cfg.content);
  const m = matrixFor(payload);
  const n = m.length;
  const fg = cfg.fg;
  const transparent = cfg.bg === "transparent";
  const bgFill = transparent ? null : cfg.bg;
  const muted = mutedOf(cfg);
  const logo = cfg.logo.kind === "none" ? null : assets.logo;

  let W: number;
  let H: number;
  let body = "";
  let coverage = 0;

  if (cfg.layout === "plain") {
    const S = 1000;
    const ms = S / n;
    W = H = Math.round(S + 8 * ms);
    const q = qrGroup(m, 4 * ms, 4 * ms, S, cfg, logo);
    body = q.markup;
    coverage = q.coverage;
  } else if (cfg.layout === "label") {
    W = 1000;
    const margin = 90;
    const S = W - 2 * margin;
    const q = qrGroup(m, margin, margin, S, cfg, logo);
    body = q.markup;
    coverage = q.coverage;
    const y = margin + S + 70;
    let markH = 0;
    if (cfg.showMark) {
      const pm = placeMark(margin, y, 190, fg, assets.mark);
      body += pm.markup;
      markH = pm.h;
    }
    const cap = cfg.caption.trim();
    if (cap) {
      const capSize = 22;
      const baseline = cfg.showMark ? y + markH - 6 : y + capSize;
      body += text(cfg.showMark ? W - margin : margin, baseline, cap, capSize, muted, { anchor: cfg.showMark ? "end" : "start", mono: true, opacity: 0.6 });
    }
    H = cfg.showMark || cap ? W + 120 : W;
  } else {
    W = 1000;
    H = 1400;
    const margin = 80;
    let y = margin;
    if (cfg.showMark) {
      body += placeMark(margin, y, 170, fg, assets.mark).markup;
      body += `<circle cx="${W - margin - 8}" cy="${y + 18}" r="8" fill="${cfg.eye ?? "#FF573B"}"/>`;
      y += 100;
    }
    const titleSize = 78;
    const lines = cfg.title.trim() ? wrap(cfg.title.trim(), titleSize, W - 2 * margin) : [];
    const maxLines = 3;
    const shown = lines.slice(0, maxLines);
    y += shown.length ? titleSize * 0.95 : 0;
    for (const ln of shown) {
      body += text(margin, y, ln, titleSize, fg, { ls: -2 });
      y += titleSize * 1.1;
    }
    if (shown.length) y -= titleSize * 1.1;
    const sub = cfg.subtitle.trim();
    if (sub) {
      y += shown.length ? 52 : 30;
      body += text(margin, y, sub, 26, muted, { opacity: 0.6 });
    }
    const footerTop = H - 130;
    const qTop = y + 70;
    const available = footerTop - 60 - qTop;
    const S = Math.min(680, available);
    const q = qrGroup(m, (W - S) / 2, qTop + (available - S) / 2, S, cfg, logo);
    body += q.markup;
    coverage = q.coverage;
    const foot = cfg.footer.trim();
    const cap = cfg.caption.trim();
    if (foot || cap) {
      body += `<line x1="${margin}" y1="${footerTop}" x2="${W - margin}" y2="${footerTop}" stroke="${fg}" stroke-opacity="0.12" stroke-width="2"/>`;
      body += text(margin, H - 82, cap, 22, muted, { mono: true, opacity: 0.6 });
      body += text(W - margin, H - 82, foot, 22, muted, { anchor: "end", opacity: 0.6 });
    }
  }

  const bgRect = bgFill ? `<rect width="${W}" height="${H}" fill="${bgFill}"/>` : "";
  const style = assets.fontStyle ? `<defs><style>${assets.fontStyle}</style></defs>` : "";
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `${style}${bgRect}${body}</svg>`;
  return { svg, width: W, height: H, payload, modules: n, coverage };
}

export function markFor(cfg: Config): string | null {
  if (cfg.logo.kind !== "brand") return null;
  return brandById(cfg.logo.id)?.file ?? null;
}
