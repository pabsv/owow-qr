import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";
import { svgToCanvas } from "./export";

let prepared = false;
function prepare() {
  if (prepared) return;
  prepared = true;
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) => (path.endsWith(".wasm") ? `${import.meta.env.BASE_URL}zxing_reader.wasm` : prefix + path),
    },
  });
}

export type ScanResult = "ok" | "fail" | "mismatch";

/**
 * Rasterise the design at a modest size (roughly what a phone camera sees
 * from arm's length) and try to decode it with zxing-cpp.
 */
export async function verify(svg: string, width: number, height: number, expected: string, transparent: boolean): Promise<ScanResult> {
  prepare();
  for (const px of [900, 500]) {
    const canvas = await svgToCanvas(svg, width, height, px);
    let source = canvas;
    if (transparent) {
      source = document.createElement("canvas");
      source.width = canvas.width + 40;
      source.height = canvas.height + 40;
      const ctx = source.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, source.width, source.height);
      ctx.drawImage(canvas, 20, 20);
    }
    const ctx = source.getContext("2d")!;
    const data = ctx.getImageData(0, 0, source.width, source.height);
    const found = await readBarcodes(data, { formats: ["QRCode"], tryHarder: true, tryInvert: true });
    if (found.length && found[0].text === expected) return "ok";
    if (found.length) return "mismatch";
  }
  return "fail";
}
