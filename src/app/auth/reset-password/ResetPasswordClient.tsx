"use client";

import { useState, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Check, CheckCircle2, Eye, EyeOff, XCircle } from "lucide-react";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const isFormValid = hasMinLength && hasUppercase && hasNumber && passwordsMatch;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) {
      setError("Token de redefinição inválido ou ausente.");
      return;
    }

    if (!isFormValid) {
      setError("Verifique se a senha atende a todos os critérios e se a confirmação coincide.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Erro ao redefinir a senha. O link pode ter expirado.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Erro de rede ao conectar com o servidor.");
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
          {!token ? (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
                <XCircle size={32} />
              </div>
              <h1 className="mb-2 text-lg font-semibold text-[#0F172A]">
                Link inválido
              </h1>
              <p className="mb-6 text-sm text-slate-600">
                O token de redefinição de senha não foi encontrado na URL. Solicite um novo link para continuar.
              </p>
              <Button onClick={() => router.push("/auth/esqueci-senha")} fullWidth size="lg">
                Solicitar novo link
              </Button>
            </div>
          ) : !success ? (
            <>
              <h1 className="mb-1 text-xl font-semibold text-[#0F172A]">
                Criar nova senha
              </h1>
              <p className="mb-6 text-sm text-slate-500">
                Cadastre sua nova senha de acesso ao HUBBY.
              </p>

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input
                  label="Nova senha"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="flex h-full items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                <Input
                  label="Confirmar nova senha"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="flex h-full items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />

                {/* Password Criteria List */}
                <div className="rounded-2xl bg-slate-50 p-4 text-xs space-y-1.5 text-slate-600">
                  <div className="flex items-center gap-2 font-medium text-slate-700 mb-1">
                    Requisitos da senha:
                  </div>
                  <div className={`flex items-center gap-2 ${hasMinLength ? "text-emerald-600 font-medium" : "text-slate-500"}`}>
                    <Check size={14} className={hasMinLength ? "text-emerald-600" : "text-slate-300"} />
                    No mínimo 8 caracteres
                  </div>
                  <div className={`flex items-center gap-2 ${hasUppercase ? "text-emerald-600 font-medium" : "text-slate-500"}`}>
                    <Check size={14} className={hasUppercase ? "text-emerald-600" : "text-slate-300"} />
                    Ao menos uma letra maiúscula (A-Z)
                  </div>
                  <div className={`flex items-center gap-2 ${hasNumber ? "text-emerald-600 font-medium" : "text-slate-500"}`}>
                    <Check size={14} className={hasNumber ? "text-emerald-600" : "text-slate-300"} />
                    Ao menos um número (0-9)
                  </div>
                  {confirmPassword.length > 0 && (
                    <div className={`flex items-center gap-2 ${passwordsMatch ? "text-emerald-600 font-medium" : "text-red-500"}`}>
                      <Check size={14} className={passwordsMatch ? "text-emerald-600" : "text-red-300"} />
                      {passwordsMatch ? "As senhas coincidem" : "As senhas não coincidem"}
                    </div>
                  )}
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  fullWidth
                  loading={loading}
                  disabled={!isFormValid}
                  size="lg"
                >
                  Redefinir senha
                </Button>
              </form>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="mb-2 text-lg font-semibold text-[#0F172A]">
                Senha redefinida com sucesso!
              </h2>
              <p className="mb-6 text-sm text-slate-600">
                Sua nova senha já está ativa. Você já pode fazer login na plataforma.
              </p>
              <Button onClick={() => router.push("/auth/login")} fullWidth size="lg">
                Ir para o Login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
