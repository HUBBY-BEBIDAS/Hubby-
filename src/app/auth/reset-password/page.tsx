import { Suspense } from "react";
import ResetPasswordClient from "./ResetPasswordClient";

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}
