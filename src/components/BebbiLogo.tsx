import React from "react";
import Image from "next/image";

interface BebbiLogoProps {
  variant?: "white" | "dark" | "card";
  height?: number;
  width?: number;
  className?: string;
}

export default function BebbiLogo({
  variant = "white",
  height = 28,
  width,
  className = "",
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
    <div className={`inline-flex items-center ${className}`}>
      <Image
        src={src}
        alt="bébbi"
        width={calcWidth}
        height={height}
        className="object-contain select-none"
        unoptimized
        priority
      />
    </div>
  );
}
