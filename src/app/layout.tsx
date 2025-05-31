import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
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
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-100">xwOBA Matchups</h1>
            <nav className="flex gap-4">
              <Link 
                href="/" 
                className="px-3 py-1 text-slate-300 hover:text-slate-100 hover:bg-slate-700 rounded transition-colors"
              >
                Daily Matchups
              </Link>
              <Link 
                href="/search" 
                className="px-3 py-1 text-slate-300 hover:text-slate-100 hover:bg-slate-700 rounded transition-colors"
              >
                Player Search
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="p-6">{children}</main>
      </body>
    </html>
  );
}
