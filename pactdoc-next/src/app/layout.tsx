import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Caveat, Kalam } from "next/font/google";
import QueryProvider from "@/providers/QueryProvider";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  weight: ["400", "500", "700", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "700"],
});

const kalam = Kalam({
  subsets: ["latin", "devanagari"],
  variable: "--font-kalam",
  display: "swap",
  weight: ["700"],
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
  weight: ["700"],
});

export const metadata: Metadata = {
  title: {
    default: "PactDoc — Legally Binding Electronic Signatures & Document Intelligence",
    template: "%s | PactDoc",
  },
  description:
    "Securely execute, track, and manage contracts, agreements, and digital signatures with audit trails and automated compliance.",
  manifest: "/site.webmanifest",
  applicationName: "PactDoc",
  icons: {
    icon: "/favicon.ico",
    apple: "/brand/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://pactdoc.com",
    siteName: "PactDoc",
    title: "PactDoc — Modern Electronic Signatures",
    description:
      "Legally binding e-signatures, cryptographic audit trails, and multi-party signing workflows.",
  },
};

export const viewport: Viewport = {
  themeColor: "#08090d",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${dmSans.variable} ${jetbrainsMono.variable} ${kalam.variable} ${caveat.variable}`}>
      <body className="min-h-screen bg-surface-canvas text-content-primary font-sans antialiased selection:bg-crimson selection:text-white">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
