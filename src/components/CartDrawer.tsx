"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  X, ShoppingCart, Trash2, Minus, Plus, Check, AlertTriangle,
  ArrowRight, Package,
} from "lucide-react";
import { useCart, CartDistributorGroup } from "@/contexts/CartContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatPackaging(type: string, ml: number): string {
  const labels: Record<string, string> = {
    garrafa: "Garrafa", lata: "Lata", barril: "Barril",
    caixa: "Caixa", fardo: "Fardo", tetra_pak: "Tetra Pak", other: "Outro",
  };
  return `${labels[type] ?? type} ${ml}ml`;
}

// ─── Badge de pedido mínimo ───────────────────────────────────────────────────

function MinOrderBadge({ subtotal, minimum }: { subtotal: number; minimum: number }) {
  if (minimum === 0) return null;
  const met = subtotal >= minimum;
  const shortfall = minimum - subtotal;

  return (
    <div className={`mt-2 flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold ${
      met ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
    }`}>
      {met ? (
        <><Check size={12} />Pedido mínimo atingido ({formatBRL(minimum)})</>
      ) : (
        <><AlertTriangle size={12} />Mínimo {formatBRL(minimum)} — faltam {formatBRL(shortfall)}</>
      )}
    </div>
  );
}

// ─── Grupo por distribuidora ──────────────────────────────────────────────────

function DistributorGroup({ group }: { group: CartDistributorGroup }) {
  const { removeItem, updateQuantity } = useCart();

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-[#DBEAFE] bg-white">
      {/* Header da distribuidora */}
      <div className="border-b border-[#DBEAFE] bg-[#F5F7FB] px-4 py-2.5">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {group.distributor.company_name}
        </p>
      </div>

      {/* Itens */}
      <ul className="divide-y divide-[#DBEAFE]">
        {group.items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3">
            {/* Imagem */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              {item.product.image_url ? (
                <img
                  src={item.product.image_url}
                  alt={item.product.name}
                  className="h-9 w-9 rounded-lg object-contain"
                />
              ) : (
                <Package size={16} className="text-slate-400" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-[#0F172A]">
                {item.product.name}
              </p>
              <p className="text-[10px] text-slate-400">
                {item.product.brand} · {formatPackaging(item.product.packaging_type, item.product.packaging_volume_ml)}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-[#2563EB]">
                {formatBRL(item.product.price_cents)}/un
              </p>
            </div>

            {/* Controles de quantidade */}
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB] active:scale-95"
              >
                <Minus size={10} />
              </button>
              <span className="w-7 text-center text-xs font-bold text-[#0F172A]">
                {item.quantity}
              </span>
              <button
                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-[#DBEAFE] text-slate-500 hover:bg-[#F5F7FB] active:scale-95"
              >
                <Plus size={10} />
              </button>
            </div>

            {/* Subtotal + remover */}
            <div className="shrink-0 text-right">
              <p className="text-xs font-bold text-[#0F172A]">
                {formatBRL(item.product.price_cents * item.quantity)}
              </p>
              <button
                onClick={() => removeItem(item.id)}
                className="mt-0.5 text-slate-300 hover:text-red-500 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* Subtotal + badge mínimo */}
      <div className="border-t border-[#DBEAFE] px-4 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-500">Subtotal</span>
          <span className="text-sm font-bold text-[#0F172A]">
            {formatBRL(group.subtotalCents)}
          </span>
        </div>
        <MinOrderBadge subtotal={group.subtotalCents} minimum={group.minimum_order_cents} />
      </div>
    </div>
  );
}

// ─── Drawer principal ─────────────────────────────────────────────────────────

export function CartDrawer() {
  const router = useRouter();
  const {
    groups, itemCount, totalCents, drawerOpen, closeDrawer,
    clearCart, checkout, loading,
  } = useCart();

  const [checkingOut, setCheckingOut] = useState(false);
  const [clearing,    setClearing]    = useState(false);

  async function handleCheckout() {
    if (checkingOut) return;
    setCheckingOut(true);
    try {
      const quotationId = await checkout();
      closeDrawer();
      router.push(`/cotacao/${quotationId}/ranking`);
    } catch (err) {
      alert((err as Error).message ?? "Erro ao criar cotação.");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleClear() {
    if (clearing) return;
    setClearing(true);
    await clearCart();
    setClearing(false);
  }

  if (!drawerOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={closeDrawer}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[420px] flex-col bg-[#F5F7FB] shadow-2xl">

        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-[#DBEAFE] bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={20} className="text-[#2563EB]" />
            <h2 className="font-bold text-[#0F172A]">
              Meu carrinho
              {itemCount > 0 && (
                <span className="ml-2 rounded-full bg-[#2563EB] px-2 py-0.5 text-xs font-bold text-white">
                  {itemCount} {itemCount === 1 ? "item" : "itens"}
                </span>
              )}
            </h2>
          </div>
          <button
            onClick={closeDrawer}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-[#F5F7FB] hover:text-[#0F172A]"
          >
            <X size={18} />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#2563EB] border-t-transparent" />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#DBEAFE]/50">
                <ShoppingCart size={28} className="text-slate-300" />
              </div>
              <div>
                <p className="font-semibold text-slate-600">Carrinho vazio</p>
                <p className="mt-1 text-sm text-slate-400">
                  Adicione produtos do catálogo ou do ranking de cotações.
                </p>
              </div>
              <button
                onClick={() => { closeDrawer(); router.push("/catalogo"); }}
                className="rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#1D4ED8]"
              >
                Ir ao catálogo
              </button>
            </div>
          ) : (
            groups.map((group) => (
              <DistributorGroup key={group.distributor_id} group={group} />
            ))
          )}
        </div>

        {/* Rodapé */}
        {groups.length > 0 && (
          <div className="border-t border-[#DBEAFE] bg-white px-5 py-4">
            {/* Total geral */}
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#DBEAFE] bg-[#F5F7FB] px-4 py-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Total geral
                </p>
                <p className="text-xs text-slate-400">
                  {groups.length} distribuidora{groups.length !== 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-xl font-extrabold text-[#0F172A]">
                {formatBRL(totalCents)}
              </p>
            </div>

            {/* Botão principal — transformar em cotação */}
            <button
              onClick={handleCheckout}
              disabled={checkingOut}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#22C55E] py-3.5 text-sm font-bold text-white transition hover:bg-[#16A34A] disabled:opacity-60"
            >
              {checkingOut ? (
                <><div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Criando cotação…</>
              ) : (
                <>Ver ranking de preços <ArrowRight size={16} /></>
              )}
            </button>

            {/* Limpar carrinho */}
            <button
              onClick={handleClear}
              disabled={clearing}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-medium text-slate-400 hover:text-red-500 transition-colors disabled:opacity-50"
            >
              <Trash2 size={14} />
              {clearing ? "Limpando…" : "Limpar carrinho"}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
