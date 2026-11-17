import { KonfidenceDevtools } from "@konfidence/next-adapter/devtools";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppLayout } from "@/components/layouts/app-layout";

import "@/styles/globals.css";

export const metadata: Metadata = {
  title: { default: "Konfidence", template: "%s · Konfidence" },
  description: "Schedule interviews with candidates.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppLayout>{children}</AppLayout>
        {/* Renders nothing unless KONFIDENCE_DEVTOOLS is set on the server. */}
        <KonfidenceDevtools />
      </body>
    </html>
  );
}
