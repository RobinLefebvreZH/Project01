"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const links = [
  { href: "/", label: "Tokens" },
  { href: "/issuer", label: "Issuer" },
  { href: "/admin", label: "Admin" },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="border-b" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold tracking-tight">
            RWA Token Factory
          </Link>
          <nav className="flex gap-4 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={path === l.href ? "font-medium" : "muted hover:underline"}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <ConnectButton showBalance={false} chainStatus="icon" />
      </div>
    </header>
  );
}
