import type { Metadata } from "next";
import "./globals.css";
import MobileDock from "@/components/MobileDock";
import PwaBootstrap from "@/components/PwaBootstrap";

export const metadata: Metadata = {
  title: "Neusic Foundry",
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
        <link rel="icon" href="/dominion-logo.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden pb-20 md:pb-0">
        <PwaBootstrap />
        {children}
        <footer className="border-t border-white/10 bg-slate-950/80 px-4 py-4 text-center text-xs text-slate-500">
          Created by Anderson · Founder · Neusic Foundry
        </footer>
        <MobileDock />
      </body>
    </html>
  );
}
