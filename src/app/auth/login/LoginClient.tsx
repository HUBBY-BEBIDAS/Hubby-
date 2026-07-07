"use client";

import { useState, FormEvent, useEffect } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Eye, EyeOff } from "lucide-react";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const { data: session, status } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [totp, setTotp] = useState("");
  const [showTotp, setShowTotp] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Redireciona usuários já autenticados para seu respectivo painel
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      const role = (session.user as any).role;
      const profileComplete = (session.user as any).profileComplete;
      if (role === "client") {
        router.replace(profileComplete ? "/cotacao" : "/perfil/completar");
      } else if (role === "platform_admin") {
        router.replace("/admin");
      } else {
        router.replace("/painel");
      }
    }
  }, [status, session, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await signIn("credentials", {
      email,
      password,
      totp: totp || undefined,
      redirect: false,
      callbackUrl,
    });

    setLoading(false);

    if (res?.error === "2FA_REQUIRED") {
      setShowTotp(true);
      return;
    }

    if (res?.error) {
      setError(
        res.error === "CredentialsSignin"
          ? "E-mail ou senha incorretos"
          : res.error
      );
      return;
    }

    if (res?.ok) {
      if (callbackUrl === "/") {
        // Redireciona com base no perfil que buscamos na API de sessão
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        const role = sessionData?.user?.role;
        const profileComplete = sessionData?.user?.profileComplete;
        if (role === "client") {
          router.push(profileComplete ? "/cotacao" : "/perfil/completar");
        } else if (role === "platform_admin") {
          router.push("/admin");
        } else {
          router.push("/painel");
        }
      } else {
        router.push(callbackUrl);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB] px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <span className="text-sm font-black uppercase tracking-[0.16em] text-[#0F172A]">
              SIC
            </span>
          </Link>
          <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-[#2563EB]">
            Plataforma B2B de cotação de bebidas
          </p>
        </div>

        <div className="rounded-3xl border border-[#DBEAFE] bg-white p-8 shadow-sm">
          <h1 className="mb-1 text-xl font-display font-semibold text-[#0F172A]">
            {showTotp ? "Verificação 2FA" : "Entrar"}
          </h1>
          <p className="mb-6 text-sm text-slate-500">
            {showTotp
              ? "Digite o código do seu aplicativo autenticador."
              : "Acesse sua conta para continuar."}
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {!showTotp ? (
              <>
                <Input
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  required
                />
                 <Input
                  label="Senha"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  suffix={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="flex h-full items-center justify-center text-slate-400 hover:text-slate-600 focus:outline-none focus:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  }
                />
              </>
            ) : (
              <Input
                label="Código 2FA"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value)}
                placeholder="000000"
                autoComplete="one-time-code"
                required
              />
            )}

            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" fullWidth loading={loading} size="lg">
              {showTotp ? "Verificar" : "Entrar"}
            </Button>
          </form>

          {!showTotp && (
            <p className="mt-4 text-center text-sm text-slate-500">
              <Link href="/auth/esqueci-senha" className="text-[#2563EB] hover:underline">
                Esqueci minha senha
              </Link>
            </p>
          )}

          {showTotp && (
            <button
              onClick={() => { setShowTotp(false); setTotp(""); }}
              className="mt-4 w-full text-center text-sm text-slate-500 hover:text-[#0F172A]"
            >
              ← Voltar para o login
            </button>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Não tem conta?{" "}
          <Link href="/auth/register" className="font-bold text-[#2563EB] hover:underline">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  );
}
