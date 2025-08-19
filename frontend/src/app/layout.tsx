import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from 'next/script';
import GaListener from './GaListener';
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "XOBCAT - XO Bot Conversation Analysis Tools",
  description: "Analytics platform for Kore.ai Expert Services teams to investigate and analyze chatbot and IVA session data",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png"
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {/* GA script */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
            send_page_view: false,
            debug_mode: ${process.env.NODE_ENV !== 'production'}
          });
        `}</Script>

        <GaListener />
        {children}
      </body>
    </html>
  );
}
