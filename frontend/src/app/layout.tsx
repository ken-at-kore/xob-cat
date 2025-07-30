import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "XOB CAT - XO Bot Conversation Analysis Tools",
  description: "Analytics platform for Kore.ai Expert Services teams to investigate and analyze chatbot and IVA session data",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/kore-emblem-grey.svg", type: "image/svg+xml" }
    ],
    shortcut: "/favicon.ico",
    apple: "/kore-emblem-grey.svg"
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
        {children}
      </body>
    </html>
  );
}
