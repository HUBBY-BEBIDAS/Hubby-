import { Suspense } from "react";
import CheckoutCompradorClient from "./CheckoutCompradorClient";

export default function CheckoutCompradorPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#22C55E] border-t-transparent" />
      </div>
    }>
      <CheckoutCompradorClient />
    </Suspense>
  );
}
