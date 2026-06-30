"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef, useCallback } from "react";
import { useApiToken, apiFetch } from "@/hooks/useApiToken";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

type NavLink = { href: string; label: string; roles: string[] };

const NAV_LINKS: NavLink[] = [
  { href: "/cotacao", label: "Nova Cotação", roles: ["client"] },
  { href: "/historico", label: "Histórico", roles: ["client"] },
  { href: "/catalogo", label: "Catálogo", roles: ["client"] },
  { href: "/lista-desejos", label: "Lista de Desejos", roles: ["client"] },
  { href: "/painel", label: "Painel", roles: ["client", "distributor_admin", "distributor_collaborator"] },
  { href: "/painel/promocoes", label: "Promoções", roles: ["distributor_admin"] },
  { href: "/painel/vencimentos", label: "Vencimentos", roles: ["distributor_admin"] },
  { href: "/painel/patrocinio", label: "Patrocínio", roles: ["distributor_admin"] },
  { href: "/painel/equipe", label: "Equipe", roles: ["distributor_admin", "distributor_collaborator"] },
  { href: "/admin", label: "Admin", roles: ["platform_admin"] },
];

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  data: Record<string, string | number | boolean | null> | null;
  created_at: string;
};

const DISTRIBUTOR_ROLES = ["distributor_admin", "distributor_collaborator"];

const NOTIF_LABEL: Record<string, string> = {
  new_order: "Nova cotação",
  new_credential_request: "Ficha cadastral",
  credential_auto_approved: "Cliente aprovado",
  credential_pending_review: "Revisão manual",
  credential_approved: "Credencial aprovada",
  credential_rejected: "Credencial recusada",
  order_status_updated: "Status do pedido",
  price_drop: "Queda de preço",
  near_expiry_alert: "Vencimento próximo",
  urgent_expiry_alert: "Urgente — vencimento",
  buyer_expiry_alert: "Oferta por tempo limitado",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "agora mesmo";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
}

function notifLink(n: Notification): string {
  const data = n.data ?? {};
  // Pedido novo ou atualizado → painel com anchor nos pedidos recentes
  if (n.type === "new_order" || n.type === "order_status_updated") {
    return `/painel#pedidos-recentes`;
  }
  // Ficha cadastral → seção de credenciais no painel
  if (n.type === "new_credential_request" || n.type === "credential_pending_review") {
    return `/painel#credenciais`;
  }
  if (n.type === "credential_auto_approved") {
    return `/painel#credenciais`;
  }
  // fallback
  void data;
  return "/painel/notificacoes";
}

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const token = useApiToken();

  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [markingAll, setMarkingAll] = useState(false);

  const bellRef = useRef<HTMLDivElement>(null);

  const role = (session?.user as { role?: string })?.role ?? "";
  const links = NAV_LINKS.filter((l) => l.roles.includes(role));
  const isDistributor = DISTRIBUTOR_ROLES.includes(role);
  const isClient = role === "client";

  const { itemCount, openDrawer } = useCart();

  // Fecha dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = useCallback(async () => {
    if (!token || !isDistributor) return;
    try {
      const res = await apiFetch("/api/notifications?limit=10", { method: "GET", token });
      if (!res.ok) return;
      const json = await res.json() as { data: Notification[]; unread_count: number };
      setNotifications(json.data);
      setUnreadCount(json.unread_count);
    } catch {
      // silencia erros de rede
    }
  }, [token, isDistributor]);

  // Busca ao montar e a cada 30s
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  async function markAllRead() {
    if (!token || markingAll) return;
    setMarkingAll(true);
    try {
      await apiFetch("/api/notifications", { method: "PATCH", token, body: JSON.stringify({ all: true }) });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleNotifClick(n: Notification) {
    setBellOpen(false);
    if (!n.read && token) {
      apiFetch("/api/notifications", { method: "PATCH", token, body: JSON.stringify({ ids: [n.id] }) }).catch(() => { });
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, read: true } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    router.push(notifLink(n));
  }

  return (
    <nav className="sticky top-0 z-40 bg-[#0F172A] shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5">
          <span className="font-extrabold tracking-tight text-[20px] uppercase text-white leading-none">HUBBY</span>
          <span className="font-mono text-[10px] font-medium text-[#22C55E] uppercase tracking-wider leading-none mt-0.5">SIC</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={[
                "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                pathname.startsWith(l.href)
                  ? "bg-white/10 font-semibold text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              ].join(" ")}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Direita: carrinho + sino + avatar */}
        <div className="flex items-center gap-3">

          {/* ── Carrinho (apenas clientes) ── */}
          {isClient && session && (
            <button
              onClick={openDrawer}
              className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Carrinho"
            >
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#22C55E] text-[9px] font-black text-white">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>
          )}

          {/* ── Sino de notificações (apenas distribuidoras) ── */}
          {isDistributor && session && (
            <div ref={bellRef} className="relative">
              <button
                onClick={() => setBellOpen((v) => !v)}
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white"
                aria-label="Notificações"
              >
                {/* Ícone sino */}
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V4a2 2 0 10-4 0v1.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {/* Badge contador */}
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown notificações */}
              {bellOpen && (
                <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl border border-[#DBEAFE] bg-white shadow-2xl shadow-slate-200/60">

                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#DBEAFE] px-4 py-3">
                    <span className="text-sm font-bold text-[#0F172A]">
                      Notificações
                      {unreadCount > 0 && (
                        <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600">
                          {unreadCount} nova{unreadCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        disabled={markingAll}
                        className="text-xs font-medium text-[#22C55E] hover:underline disabled:opacity-50"
                      >
                        Marcar todas como lidas
                      </button>
                    )}
                  </div>

                  {/* Lista */}
                  <div className="max-h-[380px] overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-slate-400">
                        Nenhuma notificação
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleNotifClick(n)}
                          className={[
                            "flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-[#F5F7FB]",
                            !n.read ? "border-l-2 border-[#22C55E] bg-[#F0FDF4]/60" : "border-l-2 border-transparent",
                          ].join(" ")}
                        >
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-xs font-bold ${n.read ? "text-slate-700" : "text-[#0F172A]"}`}>
                              {n.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                              {n.body}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              {relativeTime(n.created_at)}
                            </p>
                          </div>
                          {!n.read && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" />
                          )}
                        </button>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-[#DBEAFE] px-4 py-2.5">
                    <Link
                      href="/painel/notificacoes"
                      onClick={() => setBellOpen(false)}
                      className="block text-center text-xs font-bold text-[#22C55E] hover:underline"
                    >
                      Ver todas as notificações
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Avatar / menu de usuário */}
          {session ? (
            <div className="relative">
              <button
                onClick={() => { setMenuOpen((v) => !v); setBellOpen(false); }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#22C55E] text-sm font-bold text-white"
              >
                {session.user?.email?.[0].toUpperCase() ?? "U"}
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-100 bg-white py-1 shadow-xl">

                  {/* Email */}
                  <p className="truncate px-4 py-2 text-xs font-medium text-slate-400">
                    {session.user?.email}
                  </p>
                  <hr className="border-slate-100" />

                  {/* Menu do comprador */}
                  {role === "client" && (
                    <>
                      <Link href="/perfil/cliente" onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                        Meu Perfil
                      </Link>
                      <Link href="/meu-plano" onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                        Meu Plano
                      </Link>
                      <Link href="/relatorios" onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                        Relatórios
                      </Link>
                      <Link href="/favoritas" onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                        Favoritas
                      </Link>
                    </>
                  )}

                  {/* Menu da distribuidora */}
                  {(role === "distributor_admin" || role === "distributor_collaborator") && (
                    <>
                      <Link href="/painel" onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                        Painel
                      </Link>
                      <Link href="/perfil" onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                        Perfil da empresa
                      </Link>
                      <Link href="/meu-plano" onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                        Meu Plano
                      </Link>
                    </>
                  )}

                  {/* Informações — comum a todos */}
                  <hr className="border-slate-100" />
                  <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Informações
                  </p>
                  <Link href="/suporte" onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                    Suporte
                  </Link>
                  <Link href="/termos" onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                    Termos de Uso
                  </Link>
                  <Link href="/privacidade" onClick={() => setMenuOpen(false)}
                    className="block px-4 py-2 text-sm font-medium text-[#0F172A] hover:bg-slate-50">
                    Política de Privacidade
                  </Link>

                  <hr className="border-slate-100" />
                  <button
                    onClick={() => signOut({ callbackUrl: "/auth/login" })}
                    className="w-full px-4 py-2 text-left text-sm font-medium text-red-500 hover:bg-slate-50"
                  >
                    Sair
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/15"
            >
              Entrar
            </Link>
          )}

          {/* Mobile hamburger */}
          <button
            className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 md:hidden"
            onClick={() => { setMenuOpen((v) => !v); setBellOpen(false); }}
            aria-label="Menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d={menuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile links */}
      {menuOpen && (
        <div className="border-t border-white/10 bg-[#0F172A] px-4 pb-3 md:hidden">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className={[
                "block rounded-lg px-3 py-2.5 text-sm font-medium",
                pathname.startsWith(l.href) ? "text-white" : "text-white/70",
              ].join(" ")}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
