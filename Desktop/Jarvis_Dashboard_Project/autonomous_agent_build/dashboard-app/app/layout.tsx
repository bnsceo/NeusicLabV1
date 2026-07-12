import type { Metadata } from "next";
import Image from "next/image";
import "./globals.css";
import MobileDock from "@/components/MobileDock";
import PwaBootstrap from "@/components/PwaBootstrap";

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
        <link rel="icon" href="/cyvora-header-logo.png" type="image/png" />
      </head>
      <body className="min-h-full flex flex-col overflow-x-hidden pb-20 md:pb-0">
        {process.env.NODE_ENV === 'production' ? <PwaBootstrap /> : null}
        {children}
        <footer className="border-t border-white/10 bg-slate-950/80 px-4 py-4 text-center text-xs text-slate-500">
          <div className="mx-auto flex items-center justify-center gap-2">
            <Image src="/cyvora-header-logo.png" alt="Cyvora" width={926} height={854} className="h-5 w-auto" />
            <span>Created by Anderson · Founder · Cyvora</span>
          </div>
        </footer>
        <MobileDock />
      </body>
    </html>
  );
}
