import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "secondlife — Give your appliances a second life",
  description:
    "Slaï diagnoses your broken appliance and tells you honestly: fix it yourself, find a pro, or replace it smartly.",
};

export const viewport: Viewport = {
  themeColor: "#EFE9DC",
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
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-bone text-ink font-sans"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
