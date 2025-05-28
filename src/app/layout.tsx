import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "xwOBA Matchups",
  description: "Daily top xwOBA matchups for MLB players",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-900 text-slate-200`}
      >
        {/* Global Header */}
        <header className="p-4 border-b border-slate-700 bg-slate-800">
          <h1 className="text-2xl font-bold text-slate-100">xwOBA Matchups</h1>
        </header>

        {/* Main Content */}
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
