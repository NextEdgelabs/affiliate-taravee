import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  // Base for resolving relative canonical/OG URLs (per-page canonicals are relative).
  metadataBase: new URL(process.env.NEXT_PUBLIC_STOREFRONT_URL ?? "http://localhost:3003"),
  title: "Taravee",
  description: "Shop creator-curated picks.",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className="min-h-screen bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
