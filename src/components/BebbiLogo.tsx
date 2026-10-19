import React from "react";
import Image from "next/image";

interface BebbiLogoProps {
  variant?: "white" | "dark" | "card";
  height?: number;
  width?: number;
  className?: string;
  showSicBadge?: boolean;
}

export default function BebbiLogo({
  variant = "white",
  height = 28,
  width,
  className = "",
  showSicBadge = false,
}: BebbiLogoProps) {
  // Aspect ratio das imagens: 2840 x 1057 (~2.69)
  const calcWidth = width ?? Math.round(height * 2.69);

  const src =
    variant === "dark"
      ? "/logo-bebbi-dark.png"
      : variant === "card"
        ? "/logo-bebbi.png"
        : "/logo-bebbi-white.png";

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src={src}
        alt="bébbi"
        width={calcWidth}
        height={height}
        className="object-contain select-none"
        unoptimized
        priority
      />
      {showSicBadge && (
        <span className="font-mono text-[10px] font-bold text-[#22C55E] uppercase tracking-wider leading-none">
          SIC
        </span>
      )}
    </div>
  );
}
