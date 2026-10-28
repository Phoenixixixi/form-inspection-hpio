import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "HPIO IT Inspection | Form Inspeksi Lapangan",
  description: "Aplikasi mobile inspeksi rutin IT Datacenter dan Stasiun HPIO dengan sistem anti-cheat QR code.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className={`${jakartaSans.variable} h-full`}>
      <body className="min-h-full flex flex-col font-sans bg-[#F8FAFC]">
        {children}
      </body>
    </html>
  );
}
