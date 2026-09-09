import type { MetadataRoute } from "next";

// Installed to his phone's home screen and run as a Chrome app window on
// the old PC. Without this the "Add to Home Screen" shortcut is a browser
// tab wearing a generic icon; with it the app opens standalone, with its
// own name and the CE mark.
//
// Served at /manifest.webmanifest. The browser often fetches it without
// cookies, so middleware must let it and the icons through unauthenticated.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EzMoney — Estimates & Invoices",
    short_name: "EzMoney",
    description: "Estimates, invoices and expenses — simple.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en",
    // Paper behind the app while it loads, and the one accent teal for
    // the phone's status bar — the same two colours the app itself uses.
    background_color: "#f6f5f2",
    theme_color: "#0f766e",
    icons: [
      { src: "/brand/icon-128.png", sizes: "128x128", type: "image/png" },
      { src: "/brand/icon-180.png", sizes: "180x180", type: "image/png" },
      { src: "/brand/icon-256.png", sizes: "256x256", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/ce-icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
