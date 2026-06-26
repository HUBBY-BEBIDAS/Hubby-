"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

export interface AdminNavbarProps {
  pendingCount?: number;
}

type NavItem = {
  href: string;
  label: string;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin",               label: "Dashboard" },
  { href: "/admin/distribuidoras", label: "Distribuidoras" },
  { href: "/admin/compradores",   label: "Compradores" },
  { href: "/admin/produtos",      label: "Produtos" },
  { href: "/admin/lista-espera",  label: "Lista de Espera" },
  { href: "/admin/aprovacoes",    label: "Aprovações" },
  { href: "/admin/financeiro",    label: "Financeiro" },
  { href: "/admin/cobertura",     label: "Cobertura" },
  { href: "/admin/pesquisa",      label: "Pesquisa" },
];

export function AdminNavbar({ pendingCount = 0 }: AdminNavbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  function isActive(href: string): boolean {
    // Exact match for dashboard, prefix match for the rest
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  function linkClass(href: string): string {
    const base = "relative rounded-lg px-3 py-2 text-sm transition-colors";
    return isActive(href)
      ? `${base} bg-white/10 text-white font-semibold`
      : `${base} text-white/70 hover:text-white hover:bg-white/10 font-medium`;
  }

  return (
    <nav className="sticky top-0 z-40 bg-[#0F172A] shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">

        {/* ── Logo ── */}
        <Link href="/admin" className="flex shrink-0 items-center">
          <span className="font-extrabold tracking-tight text-[20px] uppercase text-white leading-none">
            HUBBY
          </span>
          <span className="ml-1.5 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white leading-none">
            ADMIN
          </span>
        </Link>

        {/* ── Desktop nav links ── */}
        <div className="hidden flex-1 items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={linkClass(item.href)}
            >
              {item.label}
              {/* Red dot badge for Aprovações when there are pending items */}
              {item.href === "/admin/aprovacoes" && pendingCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* ── Right side ── */}
        <div className="ml-auto flex items-center gap-3">
          {/* Exit admin button — desktop */}
          <button
            onClick={() => router.push("/cotacao")}
            className="hidden rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/15 md:inline-flex items-center gap-1.5"
          >
            <span aria-hidden="true">←</span> Sair do admin
          </button>

          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white md:hidden"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={mobileOpen}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"}
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown ── */}
      {mobileOpen && (
        <div className="border-t border-white/10 bg-[#0F172A] px-4 pb-4 md:hidden">
          <div className="flex flex-col gap-0.5 pt-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={[
                  "relative flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors",
                  isActive(item.href)
                    ? "bg-white/10 text-white font-semibold"
                    : "text-white/70 hover:text-white hover:bg-white/10 font-medium",
                ].join(" ")}
              >
                <span>{item.label}</span>
                {item.href === "/admin/aprovacoes" && pendingCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </Link>
            ))}
          </div>

          {/* Exit button — mobile */}
          <button
            onClick={() => { setMobileOpen(false); router.push("/cotacao"); }}
            className="mt-3 w-full rounded-lg border border-white/20 bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
          >
            ← Sair do admin
          </button>
        </div>
      )}
    </nav>
  );
}
