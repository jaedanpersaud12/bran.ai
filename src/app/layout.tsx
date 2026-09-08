import type { Metadata } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "bran — back office for brand owners",
  description:
    "Inventory, content, orders and revenue for a brand, in one place. From FLVS.",
  // A back office has nothing to offer a search engine, and a login wall is a
  // poor first result for anyone who lands on one.
  robots: { index: false, follow: false },
};

/**
 * Fonts and the document, and nothing else. The app's chrome lives in the
 * `(app)` group's layout so a future sign-in screen can render outside it.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
