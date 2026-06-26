export default function SiteFooter() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#0B1220]">
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">

          {/* Marca */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#22C55E]">
                <svg className="h-3.5 w-3.5 text-black" viewBox="0 0 14 14" fill="none">
                  <rect x="1" y="1" width="5" height="8" rx="1" fill="currentColor" opacity="0.9"/>
                  <rect x="8" y="1" width="5" height="4" rx="1" fill="currentColor"/>
                  <rect x="8" y="7" width="5" height="6" rx="1" fill="currentColor" opacity="0.7"/>
                </svg>
              </span>
              <span className="logo-hubby text-[18px] text-white leading-none">HUBBY</span>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-white/50">
              Plataforma B2B de cotação de bebidas para bares, restaurantes, adegas e distribuidoras.
            </p>
            <div className="mt-5 flex gap-2">
              {[{ label: "LI", title: "LinkedIn" }, { label: "IG", title: "Instagram" }, { label: "WA", title: "WhatsApp" }].map((s) => (
                <a key={s.label} href="#" title={s.title} className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-bold text-white/60 transition hover:border-[#22C55E] hover:text-[#22C55E]">
                  {s.label}
                </a>
              ))}
            </div>
          </div>

          {/* Produto */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/30">Produto</div>
            <ul className="mt-4 space-y-2.5 text-sm text-white/60">
              <li><a href="/#como-funciona" className="transition hover:text-[#22C55E]">Como funciona</a></li>
              <li><a href="/#planos" className="transition hover:text-[#22C55E]">Planos e preços</a></li>
              <li><a href="/#beneficios" className="transition hover:text-[#22C55E]">Para distribuidoras</a></li>
              <li><a href="/#beneficios" className="transition hover:text-[#22C55E]">Para compradores</a></li>
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/30">Empresa</div>
            <ul className="mt-4 space-y-2.5 text-sm text-white/60">
              <li><a href="/sobre" className="transition hover:text-[#22C55E]">Sobre nós</a></li>
              <li><a href="#" className="transition hover:text-[#22C55E]">Blog</a></li>
              <li><a href="#" className="transition hover:text-[#22C55E]">Carreiras</a></li>
              <li><a href="/suporte" className="transition hover:text-[#22C55E]">Suporte</a></li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-white/30">Contato</div>
            <ul className="mt-4 space-y-2.5 text-sm text-white/60">
              <li><a href="mailto:contato@hubby.com.br" className="transition hover:text-[#22C55E]">contato@hubby.com.br</a></li>
              <li><a href="https://wa.me/5511999999999" target="_blank" rel="noopener noreferrer" className="transition hover:text-[#22C55E]">WhatsApp comercial</a></li>
              <li className="text-white/30">São Paulo, SP — Brasil</li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 text-xs text-white/30 sm:flex-row">
          <span>© {new Date().getFullYear()} HUBBY. Todos os direitos reservados.</span>
          <div className="flex gap-5">
            <a href="/termos" className="text-white/40 transition hover:text-white/70">Termos de Uso</a>
            <a href="/privacidade" className="text-white/40 transition hover:text-white/70">Privacidade / LGPD</a>
            <a href="/suporte" className="text-white/40 transition hover:text-white/70">Suporte</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
