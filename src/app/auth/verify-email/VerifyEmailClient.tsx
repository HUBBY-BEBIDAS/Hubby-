"use client";

import { useState, useEffect, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CheckCircle2, AlertCircle, Mail, Loader2 } from "lucide-react";

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">(
    token ? "loading" : "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  // Reenviar e-mail de verificação
  const [resendEmail, setResendEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;

    async function verify() {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();
        if (!isMounted) return;

        if (res.ok && data.ok) {
          setStatus("success");
        } else {
          setStatus("error");
          setErrorMessage(data.error || "Link de verificação inválido ou expirado.");
        }
      } catch {
        if (isMounted) {
          setStatus("error");
          setErrorMessage("Erro de rede ao conectar com o servidor.");
        }
      }
    }

    verify();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleResend(e: FormEvent) {
    e.preventDefault();
    setResending(true);
    setResendSuccess(false);

    try {
      await fetch("/api/auth/send-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resendEmail }),
      });
      setResendSuccess(true);
    } catch {
      // Ignora erro e mostra mensagem genérica
      setResendSuccess(true);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 py-12">
      <div className="w-full max-w-md">
        {/* Logo Header */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="text-sm font-black uppercase tracking-[0.16em] text-[#0F172A]">
              HUBBY
            </span>
          </Link>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-[#2563EB]">
            Plataforma B2B de cotação de bebidas
          </p>
        </div>

        <div className="rounded-3xl border border-[#DBEAFE] bg-white p-8 shadow-sm">
          {status === "loading" && (
            <div className="text-center py-8">
              <Loader2 className="mx-auto mb-4 h-10 w-10 animate-spin text-[#2563EB]" />
              <h1 className="mb-2 text-lg font-semibold text-[#0F172A]">
                Verificando seu e-mail...
              </h1>
              <p className="text-sm text-slate-500">
                Aguarde alguns segundos enquanto confirmamos sua conta.
              </p>
            </div>
          )}

          {status === "success" && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={32} />
              </div>
              <h1 className="mb-2 text-lg font-semibold text-[#0F172A]">
                E-mail verificado com sucesso!
              </h1>
              <p className="mb-6 text-sm text-slate-600 leading-relaxed">
                Sua conta no HUBBY foi ativada. Você já pode fazer login e utilizar todos os recursos da plataforma.
              </p>
              <Button onClick={() => router.push("/auth/login")} fullWidth size="lg">
                Fazer Login
              </Button>
            </div>
          )}

          {(status === "error" || status === "idle") && (
            <div>
              {status === "error" && (
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                    <AlertCircle size={32} />
                  </div>
                  <h1 className="mb-2 text-lg font-semibold text-[#0F172A]">
                    Link inválido ou expirado
                  </h1>
                  <p className="text-sm text-slate-600 mb-2">
                    {errorMessage}
                  </p>
                </div>
              )}

              {status === "idle" && (
                <div className="text-center mb-6">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
                    <Mail size={32} />
                  </div>
                  <h1 className="mb-2 text-lg font-semibold text-[#0F172A]">
                    Verificação de E-mail
                  </h1>
                  <p className="text-sm text-slate-600">
                    Informe seu e-mail abaixo para receber um novo link de confirmação.
                  </p>
                </div>
              )}

              {!resendSuccess ? (
                <form onSubmit={handleResend} className="flex flex-col gap-4">
                  <Input
                    label="Endereço de e-mail"
                    type="email"
                    value={resendEmail}
                    onChange={(e) => setResendEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                  />

                  <Button type="submit" fullWidth loading={resending} size="lg">
                    Reenviar e-mail de verificação
                  </Button>
                </form>
              ) : (
                <div className="rounded-2xl bg-blue-50 p-4 text-center text-sm text-[#2563EB]">
                  <p className="font-semibold mb-1">E-mail enviado com sucesso!</p>
                  <p className="text-xs text-slate-600">
                    Se o e-mail informado estiver cadastrado e pendente de verificação, um novo link foi enviado para sua caixa de entrada.
                  </p>
                </div>
              )}

              <div className="mt-6 border-t border-slate-100 pt-6 text-center">
                <Link href="/auth/login" className="text-sm font-semibold text-[#2563EB] hover:underline">
                  Voltar para o login
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
