"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
} from "react";
import type { ProductSearchResult } from "@/app/api/products/search/route";

const PACKAGING_LABELS: Record<string, string> = {
  garrafa:   "Garrafa",
  lata:      "Lata",
  barril:    "Barril",
  caixa:     "Caixa",
  fardo:     "Fardo",
  tetra_pak: "Tetra Pak",
  other:     "Outro",
};

export function formatPackaging(type: string, volumeMl: number): string {
  const label = PACKAGING_LABELS[type] ?? type;
  return `${label} ${volumeMl}ml`;
}

type Props = {
  token: string | null;
  value: string;
  onChange: (v: string) => void;
  onSelect: (result: ProductSearchResult) => void;
  onClear?: () => void;
};

export function ProductAutocomplete({ token, value, onChange, onSelect, onClear }: Props) {
  const [results, setResults] = useState<ProductSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const selectedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current = false;
      return;
    }
    if (value.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setLoading(true);
    setIsOpen(true);
    setActiveIndex(-1);

    const timer = setTimeout(async () => {
      try {
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(
          `/api/products/search?q=${encodeURIComponent(value)}`,
          { headers }
        );
        if (res.ok) {
          const data = (await res.json()) as { results: ProductSearchResult[] };
          setResults(data.results);
        }
      } catch {
        // fail silently — usuário ainda pode tentar novamente
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [value, token]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleSelect = useCallback(
    (result: ProductSearchResult) => {
      selectedRef.current = true;
      onSelect(result);
      setIsOpen(false);
      setResults([]);
      setActiveIndex(-1);
    },
    [onSelect]
  );

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(results[activeIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  }

  const showDropdown = isOpen && value.length >= 2;

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">Buscar produto</label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (onClear && e.target.value === "") onClear();
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (value.length >= 2 && results.length > 0) setIsOpen(true);
          }}
          placeholder="ex: Heineken, Skol, Absolut…"
          autoComplete="off"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none
            focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 placeholder:text-gray-400"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-haspopup="listbox"
        />

        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="h-4 w-4 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          </div>
        )}
      </div>

      {showDropdown && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto
            rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {loading && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-400">Buscando…</li>
          )}

          {!loading && results.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">
              Nenhum produto encontrado para &ldquo;{value}&rdquo;.
            </li>
          )}

          {results.map((r, i) => (
            <li
              key={r.id}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(r);
              }}
              className={`cursor-pointer px-4 py-3 text-sm transition-colors ${
                i === activeIndex ? "bg-indigo-50 text-indigo-900" : "text-gray-900 hover:bg-gray-50"
              } ${i > 0 ? "border-t border-gray-100" : ""}`}
            >
              <span className="font-medium">{r.name}</span>
              <span className="ml-2 text-gray-500">{r.brand}</span>
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                {formatPackaging(r.packaging_type, r.packaging_volume_ml)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
