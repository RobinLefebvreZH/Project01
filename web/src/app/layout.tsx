import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "RWA Token Factory",
  description: "Issue permissioned ERC-20 tokens backed by real-world assets.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-[860px] px-[18px] pt-[6vh] pb-24 sm:px-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
