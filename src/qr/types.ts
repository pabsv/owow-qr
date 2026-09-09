export type ContentKind = "link" | "text" | "email" | "phone" | "wifi";

export type ModuleStyle = "square" | "rounded" | "dots";

export type Layout = "plain" | "label" | "card";

export type LogoChoice =
  | { kind: "none" }
  | { kind: "brand"; id: string }
  | { kind: "custom"; dataUrl: string; w: number; h: number; name: string };

export interface Content {
  kind: ContentKind;
  link: string;
  text: string;
  email: string;
  emailSubject: string;
  phone: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiSecurity: "WPA" | "WEP" | "nopass";
}

export interface Config {
  content: Content;
  logo: LogoChoice;
  logoScale: number; // fraction of QR width covered by the logo box
  style: ModuleStyle;
  fg: string;
  bg: string; // hex or "transparent"
  eye: string | null; // accent colour for the finder pupils
  layout: Layout;
  showMark: boolean; // OWOW(R) mark in label and card layouts
  title: string;
  subtitle: string;
  caption: string;
  footer: string;
}

export interface Rendered {
  svg: string;
  width: number;
  height: number;
  payload: string;
  modules: number;
  coverage: number; // fraction of module area removed for the logo
}
