import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// Branded 1200×630 share images (docs/07 A4): hotel photo, ink gradient, name
// in Cormorant Garamond, a line of detail in Instrument Sans.
export const OG_SIZE = { width: 1200, height: 630 };

const font = (file: string) => readFile(join(process.cwd(), "assets/fonts", file));

async function photoDataUrl(src: string): Promise<string | null> {
  if (!src.startsWith("/images/")) return null; // seed photos only; uploads fall back to plain
  try {
    const buf = await readFile(join(process.cwd(), "public", src));
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function shareImage(opts: { eyebrow: string; title: string; detail: string; photo?: string | null }) {
  const [serif, sans, photo] = await Promise.all([
    font("CormorantGaramond-SemiBold.ttf"),
    font("InstrumentSans-SemiBold.ttf"),
    opts.photo ? photoDataUrl(opts.photo) : Promise.resolve(null),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", backgroundColor: "#17222D" }}>
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- satori renders plain <img>
          <img src={photo} alt="" width={1200} height={630} style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }} />
        ) : null}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            backgroundImage: "linear-gradient(90deg, rgba(15,23,30,0.92) 0%, rgba(15,23,30,0.75) 45%, rgba(15,23,30,0.1) 100%)",
          }}
        />
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontFamily: "Cormorant", fontSize: 44, color: "#F3F4F2", letterSpacing: 1 }}>Selems</span>
            <span style={{ fontFamily: "Instrument", fontSize: 15, color: "#AEBBC3", letterSpacing: 4, textTransform: "uppercase", marginTop: 4 }}>
              Exclusive Hotel &amp; Suites · Akure
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
            <span style={{ fontFamily: "Instrument", fontSize: 20, color: "#E3A16A", letterSpacing: 4, textTransform: "uppercase" }}>{opts.eyebrow}</span>
            <span style={{ fontFamily: "Cormorant", fontSize: 92, lineHeight: 1.02, color: "#F3F4F2", marginTop: 12 }}>{opts.title}</span>
            <span style={{ display: "flex", alignItems: "baseline", fontFamily: "Instrument", fontSize: 30, color: "#F3F4F2", marginTop: 20 }}>
              {/* Instrument Sans has no ₦ glyph: set the sign in Cormorant, the digits in Instrument. */}
              {opts.detail.split(/(₦)/).map((part, i) =>
                part === "₦" ? (
                  <span key={i} style={{ fontFamily: "Cormorant", fontSize: 34 }}>
                    ₦
                  </span>
                ) : (
                  <span key={i}>{part}</span>
                ),
              )}
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Cormorant", data: serif, weight: 600, style: "normal" },
        { name: "Instrument", data: sans, weight: 600, style: "normal" },
      ],
    },
  );
}
