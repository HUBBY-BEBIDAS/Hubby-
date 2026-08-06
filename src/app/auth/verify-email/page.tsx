import { Suspense } from "react";
import VerifyEmailClient from "./VerifyEmailClient";

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
        </div>
      }
    >
      <VerifyEmailClient />
    </Suspense>
  );
}
