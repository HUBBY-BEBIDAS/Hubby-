"use client";

import { useState, useRef, useId } from "react";

type TooltipProps = {
  text: string;
  children?: React.ReactNode;
  /** Render a default (i) icon when no children provided */
  icon?: boolean;
  position?: "top" | "bottom";
  maxWidth?: number;
};

/**
 * Reusable tooltip — shows on hover (desktop) and tap (mobile).
 *
 * Usage:
 *   <Tooltip text="Explicação aqui">
 *     <span>conteúdo</span>
 *   </Tooltip>
 *
 *   <Tooltip text="Explicação" icon />  — renders a grey (i) icon as trigger
 */
export function Tooltip({ text, children, icon = false, position = "top", maxWidth = 200 }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  function show() {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setVisible(true);
  }

  function hide() {
    hideTimer.current = setTimeout(() => setVisible(false), 80);
  }

  const isTop = position === "top";

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      // Mobile tap support
      onClick={() => setVisible((v) => !v)}
      aria-describedby={visible ? id : undefined}
    >
      {icon ? (
        <svg
          className="h-3.5 w-3.5 text-slate-400 cursor-help"
          viewBox="0 0 16 16"
          fill="none"
          aria-label="Informação"
        >
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M8 7v5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <circle cx="8" cy="5" r="0.75" fill="currentColor"/>
        </svg>
      ) : (
        children
      )}

      {visible && (
        <span
          id={id}
          role="tooltip"
          style={{ maxWidth }}
          className={[
            "pointer-events-none absolute z-[999] w-max rounded-lg bg-[#0F172A] px-3 py-2",
            "text-xs font-medium leading-snug text-white shadow-lg",
            "animate-[tooltip-in_0.12s_ease-out_both]",
            "left-1/2 -translate-x-1/2",
            isTop ? "bottom-full mb-2" : "top-full mt-2",
          ].join(" ")}
        >
          {text}
          {/* Arrow */}
          <span
            className={[
              "absolute left-1/2 -translate-x-1/2 border-4 border-transparent",
              isTop ? "top-full border-t-[#0F172A]" : "bottom-full border-b-[#0F172A]",
            ].join(" ")}
          />
        </span>
      )}

      <style>{`
        @keyframes tooltip-in {
          from { opacity: 0; transform: translateX(-50%) translateY(${isTop ? "4px" : "-4px"}); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </span>
  );
}
