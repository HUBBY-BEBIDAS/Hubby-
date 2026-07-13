"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export type CityOption = {
  city: string;
  state: string;
};

type Props = {
  label?: string;
  value: string;
  onSelect: (option: CityOption) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  /** Se fornecido, filtra as cidades apenas do estado informado */
  stateFilter?: string;
};

/**
 * CityAutocomplete
 *
 * Input de busca de cidades com dropdown autocomplete.
 * As opções vêm de /api/coverage/cities?q=... (cidades com distribuidoras).
 * Similar ao ProductAutocomplete da tela de cotação.
 */
export function CityAutocomplete({
  label,
  value,
  onSelect,
  placeholder = "ex: Santo André, Guarulhos...",
  required = false,
  className = "",
  stateFilter,
}: Props) {
  const [inputValue, setInputValue] = useState(value);
  const [options, setOptions]       = useState<CityOption[]>([]);
  const [open, setOpen]             = useState(false);
  const [loading, setLoading]       = useState(false);
  const [highlighted, setHighlighted] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Sincroniza valor externo
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Busca cidades com debounce
  const search = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setOptions([]);
        setOpen(false);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q });
        if (stateFilter) params.set("state", stateFilter);
        const res  = await fetch(`/api/coverage/cities?${params}`);
        const data = await res.json() as { cities?: CityOption[] };
        setOptions(data.cities ?? []);
        setOpen(true);
        setHighlighted(-1);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [stateFilter]
  );

  useEffect(() => {
    const timer = setTimeout(() => search(inputValue), 300);
    return () => clearTimeout(timer);
  }, [inputValue, search]);

  // Fecha ao clicar fora
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSelect(opt: CityOption) {
    setInputValue(opt.city);
    setOptions([]);
    setOpen(false);
    onSelect(opt);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || options.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      handleSelect(options[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative flex-1 ${className}`}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-[#0F172A]">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            // Invalida a seleção se o usuário digitar livremente
            if (e.target.value !== value) onSelect({ city: "", state: "" });
          }}
          onFocus={() => { if (inputValue.length >= 2 && options.length > 0) setOpen(true); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required}
          autoComplete="off"
          className="w-full rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 text-sm text-[#0F172A] placeholder:text-slate-400 outline-none transition-colors focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#22C55E] border-t-transparent" />
          </div>
        )}
      </div>

      {open && options.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-xl border border-[#DBEAFE] bg-white shadow-lg overflow-hidden">
          {options.map((opt, i) => (
            <li
              key={`${opt.city}|${opt.state}`}
              onMouseDown={() => handleSelect(opt)}
              onMouseEnter={() => setHighlighted(i)}
              className={`flex items-center justify-between px-3 py-2.5 cursor-pointer text-sm transition-colors ${
                highlighted === i ? "bg-[#EFF6FF]" : "hover:bg-[#F5F7FB]"
              }`}
            >
              <span className="font-medium text-[#0F172A]">{opt.city}</span>
              <span className="text-xs text-slate-400 font-semibold">{opt.state}</span>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && options.length === 0 && inputValue.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-[#DBEAFE] bg-white px-3 py-3 text-xs text-slate-500 shadow-lg">
          Nenhuma cidade encontrada com distribuidoras nessa região.
        </div>
      )}
    </div>
  );
}
