"use client";

import { useState, useEffect } from "react";
import BebbiLogo from "@/components/BebbiLogo";

const navLinks: { label: string; id: string; href?: string }[] = [
  { label: "Como funciona", id: "como-funciona" },
  { label: "Benefícios",    id: "beneficios"    },
  { label: "Planos",        id: "planos"        },
  { label: "Indicação",     id: "indicacao"     },
  { label: "FAQ",           id: "faq"           },
  { label: "Sobre nós",     id: "sobre-nos",    href: "/sobre" },
];

export default function SiteNavbar({ trackSections = false }: { trackSections?: boolean }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("");

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!trackSections) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { threshold: 0, rootMargin: "-40% 0px -40% 0px" }
    );
    navLinks.forEach(({ id, href }) => {
      if (href) return;
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [trackSections]);

  return (
    <>
      <div className="fixed top-3 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <nav className="flex items-center justify-between rounded-2xl border border-white/[0.07] bg-[#0B1220]/90 px-4 py-3 backdrop-blur-2xl shadow-[0_1px_0_0_rgba(255,255,255,0.04),0_8px_32px_0_rgba(0,0,0,0.32)]">

            {/* Logo */}
            <a href="/" className="group flex items-center gap-2">
              <BebbiLogo variant="white" height={26} showSicBadge />
            </a>

            {/* Links desktop */}
            <div className="hidden items-center gap-1 md:flex">
              {navLinks.map(({ label, id, href }) => (
                <a
                  key={id}
                  href={href ?? (trackSections ? `#${id}` : `/#${id}`)}
                  className={`rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-200 ${
                    !href && activeSection === id
                      ? "bg-white/15 text-white"
                      : "text-white/75 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {label}
                </a>
              ))}
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2">
              <a href="/auth/login" className="hidden sm:block rounded-xl px-4 py-2 text-[13px] font-medium text-white/80 transition hover:text-white">
                Entrar
              </a>
              <a href="/auth/register" className="rounded-xl bg-white px-4 py-2 text-[13px] font-bold text-[#0B1220] shadow-sm transition hover:bg-white/90">
                Criar conta
              </a>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="relative z-50 flex h-11 w-11 cursor-pointer select-none items-center justify-center rounded-xl text-white/80 touch-manipulation transition hover:bg-white/10 hover:text-white md:hidden"
                aria-label="Abrir menu"
                aria-expanded={mobileMenuOpen}
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </nav>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 cursor-pointer touch-manipulation bg-black/60 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-72 bg-[#0B1220] p-6 shadow-2xl">
            <div className="mb-8 flex items-center justify-between">
              <BebbiLogo variant="white" height={22} showSicBadge />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 w-11 cursor-pointer select-none items-center justify-center rounded-xl bg-white/10 text-white touch-manipulation transition hover:bg-white/20"
                aria-label="Fechar menu"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navLinks.map(({ label, id, href }) => (
                <a
                  key={id}
                  href={href ?? (trackSections ? `#${id}` : `/#${id}`)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`rounded-xl px-4 py-3 text-base font-medium transition ${
                    !href && activeSection === id
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {label}
                </a>
              ))}
            </nav>
            <div className="mt-8 flex flex-col gap-3">
              <a href="/auth/login" className="rounded-xl border border-white/20 px-4 py-3 text-center text-sm font-medium text-white/80 transition hover:bg-white/10">
                Entrar
              </a>
              <a href="/auth/register" className="rounded-xl bg-[#22C55E] px-4 py-3 text-center text-sm font-bold text-white transition hover:bg-green-500">
                Criar conta grátis
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
