import { Suspense } from "react";
import EsqueciSenhaClient from "../esqueci-senha/EsqueciSenhaClient";

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
        </div>
      }
    >
      <EsqueciSenhaClient />
    </Suspense>
  );
}
