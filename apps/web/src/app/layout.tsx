import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProviders } from "../providers/AppProviders";

export const metadata: Metadata = {
  title: "Heuresys",
  description: "HRMS / BPM platform — admin console + employee self-service",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
