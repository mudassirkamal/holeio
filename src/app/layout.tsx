import type { Metadata, Viewport } from "next";
import { Lilita_One, Nunito } from "next/font/google";
import "./globals.css";

const display = Lilita_One({ weight: "400", subsets: ["latin"], variable: "--font-lilita" });
const body = Nunito({ subsets: ["latin"], variable: "--font-nunito", weight: ["500", "700", "800", "900"] });

export const metadata: Metadata = {
  title: "Hole Rush — swallow the city",
  description: "A hole.io-style 3D arena game: swallow the city, grow bigger and outsmart self-trained AI bots.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0b0a1f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
