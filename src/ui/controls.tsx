import type { ReactNode } from "react";

export function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 14.623 14.384" fill="currentColor" aria-hidden="true">
      <path d="M12.127 7.948H.75a.73.73 0 0 1-.535-.215A.73.73 0 0 1 0 7.198c0-.213.072-.391.215-.534A.73.73 0 0 1 .75 6.448h11.377L6.958 1.279a.72.72 0 0 1-.22-.522.75.75 0 0 1 .235-.532A.75.75 0 0 1 7.5 0c.196-.005.372.07.527.225l6.34 6.34c.094.094.16.193.198.297.039.104.058.216.058.336 0 .121-.019.233-.058.337a.83.83 0 0 1-.198.298l-6.34 6.34a.72.72 0 0 1-.527.211.75.75 0 0 1-.527-.211.75.75 0 0 1-.235-.532c-.002-.2.071-.373.22-.522z" />
    </svg>
  );
}

export function Section({ index, title, children, aside }: { index: string; title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>
          <span className="eyebrow muted" style={{ marginRight: 12 }}>
            ({index})
          </span>
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Seg<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; ariaLabel: string }) {
  return (
    <div className="seg" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span className="field-label" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--muted)" }}>
        {label}
      </span>
      {children}
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function Swatches({ value, options, onChange, allowTransparent, ariaLabel }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; allowTransparent?: boolean; ariaLabel: string }) {
  const preset = options.some((o) => o.value === value) || value === "transparent";
  return (
    <div className="swatches" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button key={o.value} type="button" className="swatch" title={o.label} aria-label={o.label} aria-pressed={value === o.value} style={{ background: o.value }} onClick={() => onChange(o.value)} />
      ))}
      {allowTransparent ? <button type="button" className="swatch transparent" title="Transparent" aria-label="Transparent" aria-pressed={value === "transparent"} onClick={() => onChange("transparent")} /> : null}
      <span className="swatch custom" title="Custom colour" aria-pressed={!preset} style={{ background: preset ? "#fff" : value }}>
        <input type="color" value={preset ? "#888888" : value} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" />
      </span>
    </div>
  );
}

export function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; format?: (v: number) => string }) {
  return (
    <label className="slider">
      <span className="mono muted" style={{ minWidth: 0 }}>
        {label}
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="mono">{format ? format(value) : value}</span>
    </label>
  );
}
