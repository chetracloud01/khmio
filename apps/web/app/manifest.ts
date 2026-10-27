import type { MetadataRoute } from "next";

// Khmio as an app on the seller's phone (2026-10-22 seller review): its own
// icon on the home screen, full screen without the browser bar, opening
// straight on the seller's dashboard. The service worker (public/sw.js)
// shows the offline page when there's no internet.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Khmio — ហាងអនឡាញរបស់អ្នក",
    short_name: "Khmio",
    description: "Sell online in minutes: products, orders, KHQR and Telegram alerts.",
    start_url: "/km/m",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4f6fa",
    theme_color: "#0e7490",
    lang: "km",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
