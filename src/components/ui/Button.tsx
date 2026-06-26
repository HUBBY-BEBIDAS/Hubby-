import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-[#22C55E] text-white hover:bg-[#16A34A] active:bg-[#15803D] disabled:opacity-50",
  secondary:
    "bg-white text-[#0F172A] border border-[#DBEAFE] hover:bg-[#F0FDF4] active:bg-[#DCFCE7] disabled:opacity-50",
  outline:
    "border border-[#22C55E] text-[#22C55E] hover:bg-[#F0FDF4] active:bg-[#DCFCE7] disabled:opacity-50",
  ghost:
    "text-[#0F172A] hover:bg-[#F0FDF4] active:bg-[#DCFCE7] disabled:opacity-50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 active:bg-red-800 disabled:opacity-50",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[13px]",
  md: "px-5 py-2.5 text-[14px]",
  lg: "px-6 py-3 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    disabled,
    children,
    className = "",
    ...props
  },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#22C55E]",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth ? "w-full" : "",
        className,
      ].join(" ")}
      {...props}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  );
});
