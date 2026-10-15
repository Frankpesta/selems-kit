import { formatDate } from "./format";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Arrive on a Friday" / "Arrive on Friday or Saturday" / null for any day. */
export function arrivalText(weekdays: number[]): string | null {
  if (!weekdays.length || weekdays.length === 7) return null;
  const names = weekdays.map((d) => DAYS[d]);
  return weekdays.length === 1
    ? `Arrive on a ${names[0]}`
    : `Arrive on ${names.slice(0, -1).join(", ")} or ${names.at(-1)}`;
}

export const validityText = (from: string, to: string) => `For stays between ${formatDate(from)} and ${formatDate(to)}`;
