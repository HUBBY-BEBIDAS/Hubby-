"use client";

import { SessionProvider } from "next-auth/react";
import { CartProvider } from "@/contexts/CartContext";
import { CartDrawer } from "@/components/CartDrawer";
import { QuotationProvider } from "@/contexts/QuotationContext";
import { FloatingQuotationButton } from "@/components/FloatingQuotationButton";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <CartProvider>
        <QuotationProvider>
          {children}
          <CartDrawer />
          <FloatingQuotationButton />
        </QuotationProvider>
      </CartProvider>
    </SessionProvider>
  );
}
