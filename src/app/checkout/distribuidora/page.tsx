import { Suspense } from "react";
import CheckoutDistribuidoraClient from "./CheckoutDistribuidoraClient";

export default function CheckoutDistribuidoraPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
      </div>
    }>
      <CheckoutDistribuidoraClient />
    </Suspense>
  );
}
