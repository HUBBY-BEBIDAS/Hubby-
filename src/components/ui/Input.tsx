import { InputHTMLAttributes, forwardRef, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, suffix, className = "", ...props },
  ref
) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "_");

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-[14px] font-semibold text-[#0F172A]">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          className={[
            "w-full rounded-xl border px-3 py-2.5 text-[14px] font-medium text-[#0F172A] placeholder:text-slate-400 placeholder:font-normal",
            "transition-colors outline-none disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed disabled:border-[#DBEAFE]/70",
            suffix ? "pr-10" : "",
            error
              ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200"
              : "border-[#DBEAFE] bg-white focus:border-[#22C55E] focus:ring-2 focus:ring-[#22C55E]/20",
            className,
          ].join(" ")}
          {...props}
        />
        {suffix && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
            {suffix}
          </div>
        )}
      </div>
      {error && <p className="text-xs font-medium text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs font-medium text-slate-500">{hint}</p>}
    </div>
  );
});
