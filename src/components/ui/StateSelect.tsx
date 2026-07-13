"use client";

import React from "react";
import { ChevronDown } from "lucide-react";

export const BRAZIL_STATES = [
  { uf: "AC", name: "Acre" },
  { uf: "AL", name: "Alagoas" },
  { uf: "AP", name: "Amapá" },
  { uf: "AM", name: "Amazonas" },
  { uf: "BA", name: "Bahia" },
  { uf: "CE", name: "Ceará" },
  { uf: "DF", name: "Distrito Federal" },
  { uf: "ES", name: "Espírito Santo" },
  { uf: "GO", name: "Goiás" },
  { uf: "MA", name: "Maranhão" },
  { uf: "MT", name: "Mato Grosso" },
  { uf: "MS", name: "Mato Grosso do Sul" },
  { uf: "MG", name: "Minas Gerais" },
  { uf: "PA", name: "Pará" },
  { uf: "PB", name: "Paraíba" },
  { uf: "PR", name: "Paraná" },
  { uf: "PE", name: "Pernambuco" },
  { uf: "PI", name: "Piauí" },
  { uf: "RJ", name: "Rio de Janeiro" },
  { uf: "RN", name: "Rio Grande do Norte" },
  { uf: "RS", name: "Rio Grande do Sul" },
  { uf: "RO", name: "Rondônia" },
  { uf: "RR", name: "Roraima" },
  { uf: "SC", name: "Santa Catarina" },
  { uf: "SP", name: "São Paulo" },
  { uf: "SE", name: "Sergipe" },
  { uf: "TO", name: "Tocantins" },
];

type Props = {
  label?: string;
  value: string;
  onChange: (uf: string) => void;
  required?: boolean;
  className?: string;
};

/**
 * StateSelect
 *
 * Select estilizado com todos os estados brasileiros.
 * O usuário pode digitar manualmente a sigla (via input) ou
 * escolher na lista suspensa (via select).
 */
export function StateSelect({ label, value, onChange, required = false, className = "" }: Props) {
  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="mb-1 block text-sm font-medium text-[#0F172A]">
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="w-full appearance-none rounded-xl border border-[#DBEAFE] bg-[#F5F7FB] px-3 py-2.5 pr-8 text-sm text-[#0F172A] outline-none transition-colors focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20"
        >
          <option value="">UF</option>
          {BRAZIL_STATES.map((s) => (
            <option key={s.uf} value={s.uf}>
              {s.uf} – {s.name}
            </option>
          ))}
        </select>
        <ChevronDown
          size={14}
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </div>
    </div>
  );
}
