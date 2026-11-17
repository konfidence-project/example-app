import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hiring desk",
  description:
    "Konfidence example app: a Next.js frontend for the candidates and interviews services",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">
            Hiring desk
          </Link>
          <nav>
            <Link href="/">Desk</Link>
            <Link href="/about">How this is deployed</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
