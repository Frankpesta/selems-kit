#!/usr/bin/env node
// Checks every old WordPress URL (docs/03 "Routing, old-URL redirects") lands on
// its new page with permanent redirects only, ending in a 200.
//
//   node scripts/check-redirects.mjs                          # http://localhost:3000
//   node scripts/check-redirects.mjs https://selemsexclusivehotel.com --www
//
// --www also checks that https://www.<host> redirects to the apex.

const args = process.argv.slice(2);
const base = (args.find((a) => !a.startsWith("--")) ?? "http://localhost:3000").replace(/\/$/, "");
const checkWww = args.includes("--www");

const MAP = [
  ["/room/", "/rooms"],
  ["/room", "/rooms"],
  ["/rooms/diplomatic-suite/", "/rooms/diplomatic-suite"],
  ["/rooms/business/", "/rooms/business-room"],
  ["/rooms/executive-double/", "/rooms/executive-double"],
  ["/rooms/executive-suite/", "/rooms/executive"],
  ["/rooms/royal-suite/", "/rooms/royal-suite"],
  ["/rooms/vip-suite/", "/rooms/vip-suite"],
  ["/rooms/pent-house/", "/rooms/penthouse"],
  ["/rooms/deluxe-room/", "/rooms/deluxe-room"],
  ["/rooms/standard-room/", "/rooms/standard-room"],
  ["/facilities/", "/facilities"],
  ["/gallery/", "/gallery"],
  ["/contact/", "/contact"],
  ["/reservations", "/book"],
  ["/reservations%20", "/book"],
  ["/reservations/", "/book"],
  ["/wp-content/uploads/2023/05/room.jpg", "/gallery"],
  ["/wp-admin", "/admin/login"],
  ["/wp-login.php", "/admin/login"],
];

const PERMANENT = new Set([301, 308]);

async function follow(url, maxHops = 4) {
  const hops = [];
  let current = url;
  for (let i = 0; i <= maxHops; i++) {
    const res = await fetch(current, { redirect: "manual", headers: { "user-agent": "selems-redirect-check" } });
    hops.push(res.status);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    return { hops, final: current, status: res.status };
  }
  return { hops, final: current, status: -1 };
}

let failures = 0;
for (const [from, to] of MAP) {
  const { hops, final, status } = await follow(base + from);
  const path = new URL(final).pathname;
  // The admin sign-in may add ?next=…; compare paths only.
  const ok = path === to && status === 200 && hops.slice(0, -1).every((s) => PERMANENT.has(s)) && hops.length > 1;
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${from} → ${path} [${hops.join(" → ")}]${ok ? "" : `  (expected ${to}, permanent redirects, final 200)`}`);
}

if (checkWww) {
  const u = new URL(base);
  const www = `${u.protocol}//www.${u.host.replace(/^www\./, "")}/rooms`;
  const { hops, final } = await follow(www);
  const ok = new URL(final).host === u.host.replace(/^www\./, "") && PERMANENT.has(hops[0]);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} www → apex: ${www} → ${final} [${hops.join(" → ")}]`);
}

console.log(failures ? `\n${failures} redirect check(s) failed.` : `\nAll ${MAP.length} redirects OK.`);
process.exit(failures ? 1 : 0);
