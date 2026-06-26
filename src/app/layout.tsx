import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HUBBY — SIC · Sistema Integrado de Cotações",
  description: "Plataforma B2B de cotação e distribuição de bebidas para bares, restaurantes e adegas.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`h-full overflow-x-hidden ${jakarta.variable} ${mono.variable}`}>
      <body className="min-h-full bg-[#F5F7FB] font-sans text-[#0F172A]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
