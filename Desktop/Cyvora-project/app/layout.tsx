import type { Metadata } from "next";
import "./globals.css";
import PwaBootstrap from "@/components/PwaBootstrap";
import AppShell from "@/components/AppShell";

export const metadata: Metadata = {
  title: "Cyvora · AI Command Center",
  description: "Autonomous business operating system for the Anderson founder stack",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <meta name="theme-color" content="#070b12" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/cyvora-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/cyvora-icon.svg" />
      </head>
      <body className="min-h-full overflow-x-hidden">
        {process.env.NODE_ENV === 'production' ? <PwaBootstrap /> : null}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
