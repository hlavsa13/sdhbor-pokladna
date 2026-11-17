import "./globals.css";

import type { Metadata, Viewport } from "next";
import { ConvexClientProvider } from "@/components/convex-client-provider";

export const metadata: Metadata = {
  title: "SDH Hospodaření",
  description: "Aplikace pro sledování hospodaření sboru dobrovolných hasičů",
  // Ikona na plochu telefonu (PWA)
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Pokladna SDH",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#D11A1A",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body className="antialiased" suppressHydrationWarning={true}>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
