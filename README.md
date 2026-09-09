# OWOW® QR studio

Branded QR code generator for OWOW. Everything runs in the browser: the code is
generated locally, the logo is knocked out of the centre, and the result is
exported as PNG (1000, 2000 or 4000 px) or SVG with the brand fonts embedded.

Static codes only. The link is encoded in the pattern itself, so nothing expires
and no third party sits between the scan and the page.

## Features

- Content types: link, text, email, phone, wifi
- Logos: every OWOW mark from the brand guidelines, or upload your own PNG, JPG, SVG or WebP
- Looks: square, rounded or dot modules, brand colour swatches or any custom colour, transparent background, accent colour on the finder eyes
- Layouts: code only, code with label, poster card with editable title, subtitle and footer
- Live scan check with zxing-cpp (WASM) after every change, so you know it decodes before you print

## Stack

Vite, React 19, TypeScript. `qrcode-generator` for the matrix, `zxing-wasm` for
the scan check. No backend.

```bash
pnpm install
pnpm dev
pnpm build
```

## Notes

- Error correction is always level H. Keep the logo under roughly 12% of the code area; the badge in the preview tells you when it stops scanning.
- Brand SVGs live in `public/logos` and use `currentColor`, so they follow the chosen foreground colour.
- Switzer is fetched from Fontshare at export time and embedded as base64, so exported files render correctly anywhere.

Live: https://owow-qr.vercel.app
