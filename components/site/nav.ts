// Main navigation (docs/05 "Global"). Order and labels are fixed by the design.
export const NAV_LINKS = [
  { href: "/rooms", label: "Rooms & Suites" },
  { href: "/dining", label: "Dining & Bars" },
  { href: "/facilities", label: "Facilities" },
  { href: "/gallery", label: "Gallery" },
  { href: "/akure-guide", label: "Akure Guide" },
  { href: "/contact", label: "Contact" },
] as const;

export type ContactLinks = {
  phone: string; // display
  phoneHref: string;
  whatsappHref: string | null;
};
