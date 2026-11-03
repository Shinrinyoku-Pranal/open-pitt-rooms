import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const alt = `${SITE_NAME} — ${SITE_TAGLINE}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/logo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 56,
          padding: "0 80px",
          background: "#000000",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <img src={logoSrc} width={420} height={420} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#FFB81C" }}>{SITE_NAME}</div>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.05, maxWidth: 620 }}>
            Find an open study room at Pitt, right now.
          </div>
          <div style={{ fontSize: 28, color: "#a1a1ad" }}>Every official study space · Live from 25Live</div>
        </div>
      </div>
    ),
    size,
  );
}
