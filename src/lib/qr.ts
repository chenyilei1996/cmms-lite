import { randomBytes } from "node:crypto";
import QRCode from "qrcode";

export function newToken(size = 12) {
  return randomBytes(size).toString("base64url");
}

export function publicBaseUrl() {
  return (process.env.PUBLIC_BASE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

export function repairUrl(token: string) {
  return `${publicBaseUrl()}/r/${token}`;
}

export function deviceUrl(token: string) {
  return `${publicBaseUrl()}/d/${token}`;
}

export function trackUrl(token: string) {
  return `${publicBaseUrl()}/t/${token}`;
}

export function routeUrl(token: string) {
  return `${publicBaseUrl()}/i/${token}`;
}

export function resolveBaseUrl(host?: string | null, proto?: string | null) {
  const configured = process.env.PUBLIC_BASE_URL;
  const isLocal =
    !configured ||
    /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(configured);
  if (!isLocal) return configured.replace(/\/$/, "");
  if (host) return `${proto || "http"}://${host}`;
  return (configured ?? "http://localhost:3000").replace(/\/$/, "");
}

export function sparePartUrl(token: string, base?: string) {
  return `${(base ?? publicBaseUrl()).replace(/\/$/, "")}/m/spare-parts/${token}`;
}

export async function qrDataUrl(text: string) {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: 480,
    errorCorrectionLevel: "M",
    color: { dark: "#0f0f0f", light: "#ffffff" },
  });
}
