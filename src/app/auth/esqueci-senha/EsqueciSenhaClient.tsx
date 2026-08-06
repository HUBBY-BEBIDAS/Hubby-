"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";

export default function EsqueciSenhaClient() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Ocorreu um erro ao processar sua solicitação.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setError("Erro de rede. Tente novamente em alguns instantes.");
    } finally {
      setLoading(false);
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
          {!submitted ? (
            <>
              <h1 className="mb-1 text-xl font-semibold text-[#0F172A]">
                Recuperar senha
              </h1>
              <p className="mb-6 text-sm text-slate-500">
                Digite o e-mail associado à sua conta. Enviaremos um link de redefinição com validade de 30 minutos.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="E-mail cadastrado"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />

                {error && (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button type="submit" fullWidth loading={loading} size="lg">
                  Enviar link de redefinição
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-[#2563EB]">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-[#0F172A]">
                Instruções enviadas!
              </h2>
              <p className="mb-6 text-sm text-slate-600 leading-relaxed">
                Se o e-mail <strong>{email}</strong> estiver cadastrado em nossa plataforma, você receberá as instruções em instantes. Verifique também sua caixa de spam.
              </p>
              <Button
                variant="outline"
                fullWidth
                onClick={() => setSubmitted(false)}
                className="mb-2"
              >
                Tentar outro e-mail
              </Button>
            </div>
          )}

          <div className="mt-6 border-t border-slate-100 pt-6 text-center">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#2563EB] hover:underline"
            >
              <ArrowLeft size={16} />
              Voltar para a página de login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
