export interface BrandLogo {
  id: string;
  file: string;
  label: string;
  short: string;
  group: "symbol" | "mark" | "wide";
  w: number;
  h: number;
}

// Base files use fill="currentColor", so they follow the foreground colour.
export const BRAND_LOGOS: BrandLogo[] = [
  { id: "symbol-venture", file: "owow-symbol-venture-studio.svg", label: "Venture® Studio symbol", short: "Venture Studio", group: "symbol", w: 316, h: 316 },
  { id: "symbol-product", file: "owow-symbol-product-studio.svg", label: "Product® Studio symbol", short: "Product Studio", group: "symbol", w: 316, h: 316 },
  { id: "symbol-wizkids", file: "owow-symbol-wizkids.svg", label: "Wizkids symbol", short: "Wizkids", group: "symbol", w: 316, h: 316 },
  { id: "logomark", file: "owow-logomark-overall.svg", label: "OWOW® logomark", short: "Logomark", group: "mark", w: 589, h: 126.626 },
  { id: "wordmark", file: "owow-wordmark-full.svg", label: "OWOW® Product Studio wordmark", short: "Wordmark", group: "wide", w: 666.293, h: 47.107 },
  { id: "logotype", file: "owow-logotype-product-studio.svg", label: "Product® Studio logotype", short: "Logotype", group: "wide", w: 756.317, h: 85.228 },
  { id: "lockup", file: "owow-lockup-product-studio.svg", label: "Product® Studio lock-up", short: "Lock-up", group: "wide", w: 992.817, h: 172.5 },
];

export const MARK = BRAND_LOGOS.find((l) => l.id === "logomark")!;

const cache = new Map<string, Promise<string>>();

/** Inner SVG markup (no outer <svg>) of a brand logo, cached. */
export function loadLogoInner(file: string): Promise<string> {
  let p = cache.get(file);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}logos/${file}`)
      .then((r) => r.text())
      .then((s) =>
        s
          .replace(/<metadata>[\s\S]*?<\/metadata>/g, "")
          .replace(/^[\s\S]*?<svg[^>]*>/, "")
          .replace(/<\/svg>\s*$/, "")
          .trim(),
      );
    cache.set(file, p);
  }
  return p;
}

export function brandById(id: string): BrandLogo | undefined {
  return BRAND_LOGOS.find((l) => l.id === id);
}
