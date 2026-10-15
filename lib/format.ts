// Display formatting shared by the site and emails. Dates are business dates
// ("YYYY-MM-DD"), formatted in UTC so the reader's time zone never shifts them.
import { parse } from "./dates";

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** "2026-10-24" → "Sat 24 Oct 2026" */
export const formatDate = (d: string) => dayFmt.format(parse(d)).replace(",", "");

/** "2026-10-24" → "Sat 24 Oct" */
export const formatDateShort = (d: string) => shortFmt.format(parse(d)).replace(",", "");

/** "14:00" → "2:00 pm" */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "2 adults, 1 child" */
export const formatParty = (adults: number, children: number) =>
  children > 0 ? `${plural(adults, "adult")}, ${plural(children, "child", "children")}` : plural(adults, "adult");

/** "+2349031559943" → "+234 903 155 9943" */
export function formatPhone(e164: string): string {
  const m = /^\+234(\d{3})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
