import type { Metadata, Viewport } from "next";

import { Toaster } from "@taravee/ui/components/sonner";

import { PwaRegister } from "@/components/pwa-register";

import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Taravee Admin",
  title: { default: "Taravee Admin", template: "%s · Taravee Admin" },
  description: "Taravee affiliate platform — admin dashboard",
  icons: {
    icon: "/favicon.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Taravee Admin",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#c9a227" },
    { media: "(prefers-color-scheme: dark)", color: "#121110" },
  ],
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
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
