// Contact links derived from hotel settings. Pure functions, shared by pages,
// JSON-LD and emails so the NAP (name, address, phone) is identical everywhere.
import { formatPhone } from "./format";

type Phone = { label: string; number: string; whatsapp: boolean };
type Address = { street: string; locality: string; region: string; country: string; postalCode?: string };

export const mainPhone = (phones: Phone[]) => phones[0];
export const whatsappPhone = (phones: Phone[]) => phones.find((p) => p.whatsapp) ?? null;

export const telHref = (e164: string) => `tel:${e164}`;
export const displayPhone = formatPhone;

export function whatsappHref(e164: string, message?: string) {
  const base = `https://wa.me/${e164.replace(/\D/g, "")}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** "Atibiti Layout, Ijapo Extension, Akure, Ondo State" */
export const addressLine = (a: Address, withCountry = false) =>
  [a.street, a.locality, a.region, withCountry ? "Nigeria" : null].filter(Boolean).join(", ");

export function mapsHref(hotelName: string, a: Address, geo?: { lat: number; lng: number } | null) {
  const q = geo ? `${geo.lat},${geo.lng}` : `${hotelName}, ${addressLine(a)}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function mapsEmbedSrc(hotelName: string, a: Address, geo?: { lat: number; lng: number } | null, custom?: string | null) {
  if (custom) return custom;
  const q = geo ? `${geo.lat},${geo.lng}` : `${hotelName}, ${addressLine(a)}`;
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
}

/** Fills "{name}" slots in staff-editable copy, e.g. "from {fromRate} a night". Unfilled slots are removed. */
export const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "").replace(/\s{2,}/g, " ").trim();
