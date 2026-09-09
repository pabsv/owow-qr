import monoUrl from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url";

const SWITZER_CSS = "https://api.fontshare.com/v2/css?f%5B%5D=switzer@400,500&display=swap";

async function toBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const buf = await r.arrayBuffer();
    let bin = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    return btoa(bin);
  } catch {
    return null;
  }
}

let cached: Promise<string> | null = null;

/**
 * A <style> body that embeds Switzer (400, 500) and JetBrains Mono (400) as
 * base64 so exported SVG and PNG files render with the real brand fonts.
 * Falls back to empty declarations when a font cannot be fetched.
 */
export function embeddedFontStyle(): Promise<string> {
  if (cached) return cached;
  cached = (async () => {
    const faces: string[] = [];
    try {
      const css = await fetch(SWITZER_CSS).then((r) => r.text());
      const blocks = css.split("@font-face").slice(1);
      for (const b of blocks) {
        const weight = /font-weight:\s*(\d+)/.exec(b)?.[1] ?? "400";
        const url = /url\('?(\/\/[^')]+\.woff2)'?\)/.exec(b)?.[1];
        if (!url) continue;
        const b64 = await toBase64(`https:${url}`);
        if (b64) faces.push(`@font-face{font-family:'Switzer';font-weight:${weight};src:url(data:font/woff2;base64,${b64}) format('woff2');}`);
      }
    } catch {
      /* offline: fall back to system fonts */
    }
    const mono = await toBase64(monoUrl);
    if (mono) faces.push(`@font-face{font-family:'JetBrains Mono';font-weight:400;src:url(data:font/woff2;base64,${mono}) format('woff2');}`);
    return faces.join("");
  })();
  return cached;
}
