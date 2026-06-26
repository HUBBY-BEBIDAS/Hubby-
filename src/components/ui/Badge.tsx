type BadgeVariant = "green" | "red" | "yellow" | "blue" | "gray" | "indigo";

const variants: Record<BadgeVariant, string> = {
  green:  "bg-green-100 text-green-800",
  red:    "bg-red-100 text-red-800",
  yellow: "bg-amber-100 text-amber-800",
  blue:   "bg-blue-100 text-blue-800",
  gray:   "bg-gray-100 text-gray-700",
  indigo: "bg-indigo-100 text-indigo-800",
};

export function Badge({
  children,
  variant = "gray",
  className = "",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
