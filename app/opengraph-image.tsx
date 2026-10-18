import { ImageResponse } from "next/og"

export const alt = "Mandarin — live sports arbitrage across US sportsbooks"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#1c120b",
          backgroundImage: "linear-gradient(135deg, #1c120b 0%, #3d220f 55%, #9a4d12 100%)",
          padding: "72px",
          color: "#fffaf5",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: "#ffb74d",
              display: "flex",
              marginRight: 20,
            }}
          />
          <div style={{ display: "flex", fontSize: 36, fontWeight: 600, letterSpacing: -0.4 }}>Mandarin</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 72,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: -1.8,
              maxWidth: 920,
            }}
          >
            Live sports arbitrage
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 24,
              fontSize: 30,
              lineHeight: 1.35,
              color: "#ffd7b0",
              maxWidth: 860,
            }}
          >
            Cross-book odds from US sportsbooks, scanned for price gaps.
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#ffb74d" }}>betmandarin.online</div>
      </div>
    ),
    { ...size },
  )
}
