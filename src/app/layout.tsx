import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EzMoney",
  description: "Estimates, invoices and expenses — simple.",
  // iOS ignores the manifest for the home-screen icon and reads this
  // instead, so a phone install needs both.
  icons: {
    apple: "/brand/icon-180.png",
  },
  appleWebApp: {
    capable: true,
    title: "EzMoney",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
