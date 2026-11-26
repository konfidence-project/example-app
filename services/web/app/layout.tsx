import { KonfidenceDevtools } from "@konfidence/next-devtools/devtools";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "Interviews",
  description: "Konfidence example app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        {/* Renders nothing unless KONFIDENCE_DEVTOOLS is set on the server. */}
        <KonfidenceDevtools />
      </body>
    </html>
  );
}
